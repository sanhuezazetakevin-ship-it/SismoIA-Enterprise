

"""
SismoIA Enterprise - Fase 8
Monitoreo supervisado de eventos sísmicos USGS.

Funciones:
- Consultar eventos observados desde USGS.
- Comprobar integridad del catálogo.
- Admitir respuestas sin metadata.count.
- Detectar eventos nuevos.
- Evitar candidatos duplicados.
- Crear avisos pendientes de revisión humana.
- Registrar ejecuciones y auditoría.

SEGURIDAD:
Este módulo NUNCA aprueba ni envía avisos automáticamente.
"""

import logging

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import (
    audit,
    db_session,
    permissions,
    require,
)

from app.auth_models import User
from app.alert_models import Alert, AlertRule
from app.alert_rules import eligible
from app.monitoring_models import MonitorCandidate, MonitorRun
from app.config import settings
from app.live_catalog import get_page


# ==========================================================
# CONFIGURACIÓN
# ==========================================================

router = APIRouter(
    prefix="/api/v1/monitoring",
    tags=["Supervised USGS monitoring"],
)

logger = logging.getLogger(__name__)

PAGE_LIMIT = 1000
MAX_DAYS = 7
MIN_MAGNITUDE = 3.5
MAX_MAGNITUDE = 9.9


# ==========================================================
# CONSULTAR Y VALIDAR CATÁLOGO USGS
# ==========================================================

def fetch_complete_events(
    *,
    start: datetime,
    end: datetime,
    minimum: float,
):
    """
    Recupera una ventana acotada de USGS.

    Reglas:
    - Rechazar registros no normalizables.
    - Rechazar catálogos mayores que PAGE_LIMIT.
    - Si existe total, comprobar su integridad.
    - Si falta total y la página está llena,
      consultar la página siguiente para confirmar
      que no hay resultados adicionales.

    Una respuesta vacía solo se acepta si get_page()
    consiguió una respuesta válida del proveedor.
    """

    response = get_page(
        start=start,
        end=end,
        peru_only=True,
        minimum=minimum,
        limit=PAGE_LIMIT,
        offset=1,
    )

    events = response["events"]
    total = response["total"]
    skipped = response["skipped"]
    cache_hit = response.get("cache_hit", False)

    logger.info(
        "USGS: total=%s, procesados=%s, omitidos=%s, cache=%s",
        total,
        len(events),
        skipped,
        cache_hit,
    )

    # ------------------------------------------------------
    # 1. Rechazar eventos inválidos
    # ------------------------------------------------------

    if skipped:
        raise HTTPException(
            status_code=503,
            detail=(
                "USGS devolvió eventos no normalizables. "
                "No se generaron candidatos."
            ),
        )

    # ------------------------------------------------------
    # 2. Cuando USGS informa el total
    # ------------------------------------------------------

    if total is not None:

        if total > PAGE_LIMIT:
            raise HTTPException(
                status_code=503,
                detail=(
                    "USGS contiene más eventos que el "
                    "límite de monitoreo. "
                    "Reduzca el período o aumente "
                    "la magnitud mínima."
                ),
            )

        if len(events) != total:
            raise HTTPException(
                status_code=503,
                detail=(
                    "La cantidad de eventos recibidos "
                    "no coincide con el total informado "
                    "por USGS. No se generaron candidatos."
                ),
            )

    # ------------------------------------------------------
    # 3. Cuando USGS no informa el total
    # ------------------------------------------------------

    else:

        logger.warning(
            "USGS no informó metadata.count. "
            "Verificando completitud mediante paginación."
        )

        # Una página con menos de PAGE_LIMIT registros
        # se considera agotada conforme a la paginación.
        #
        # Esto presupone que get_page() recibió y validó
        # correctamente una respuesta GeoJSON de USGS.

        if len(events) >= PAGE_LIMIT:

            # Consultar un registro adicional.
            # Si existe, no podemos procesar esta ventana
            # como un catálogo completo.

            next_page = get_page(
                start=start,
                end=end,
                peru_only=True,
                minimum=minimum,
                limit=1,
                offset=PAGE_LIMIT + 1,
            )

            next_events = next_page["events"]
            next_skipped = next_page["skipped"]
            next_total = next_page["total"]

            if next_skipped:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "USGS devolvió registros adicionales "
                        "que no pudieron normalizarse."
                    ),
                )

            if next_events or (
                next_total is not None
                and next_total > PAGE_LIMIT
            ):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "El catálogo excede el límite de "
                        "1000 eventos. No se generaron "
                        "candidatos incompletos."
                    ),
                )

    return events, cache_hit


# ==========================================================
# SERVICIO PRINCIPAL DE MONITOREO
# ==========================================================

def scan(
    db: Session,
    actor: User,
    *,
    days: int = 1,
    minimum: float = 4.5,
):
    """
    Ejecuta el monitoreo supervisado de USGS.

    Genera avisos pendientes, nunca aprobados
    ni enviados automáticamente.
    """

    # ------------------------------------------------------
    # 1. Validar autorización
    # ------------------------------------------------------

    if (
        actor is None
        or not actor.is_active
        or "alertas.configurar" not in permissions(db, actor)
    ):
        raise HTTPException(
            status_code=403,
            detail="Operador de monitoreo no autorizado",
        )

    # ------------------------------------------------------
    # 2. Comprobar que el monitoreo esté habilitado
    # ------------------------------------------------------

    if not settings.monitoring_enabled:
        raise HTTPException(
            status_code=503,
            detail=(
                "Monitoreo desactivado. "
                "Configure MONITORING_ENABLED=true."
            ),
        )

    # ------------------------------------------------------
    # 3. Validar parámetros
    # ------------------------------------------------------

    if not 1 <= days <= MAX_DAYS:
        raise HTTPException(
            status_code=422,
            detail="days debe estar entre 1 y 7",
        )

    if not MIN_MAGNITUDE <= minimum <= MAX_MAGNITUDE:
        raise HTTPException(
            status_code=422,
            detail="minimum debe estar entre 3.5 y 9.9",
        )

    # ------------------------------------------------------
    # 4. Determinar rango temporal
    # ------------------------------------------------------

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    # ------------------------------------------------------
    # 5. Consultar y validar USGS
    # ------------------------------------------------------

    try:
        events, cache_hit = fetch_complete_events(
            start=start,
            end=end,
            minimum=minimum,
        )
    except HTTPException as exc:
        if exc.status_code in (502, 503):
            db.rollback()
            from app.snapshots import record_failure
            record_failure(db, start=start, end=end, minimum=minimum,
                           actor_id=actor.id, purpose="monitoring", failure=exc)
        raise

    logger.info(
        "SismoIA: catálogo completo. Eventos=%s",
        len(events),
    )

    # ------------------------------------------------------
    # 6. Conservar evidencia de esta consulta aprobada
    # ------------------------------------------------------
    from app.snapshots import record_success
    query_snapshot = record_success(
        db, start=start, end=end, minimum=minimum, events=events,
        actor_id=actor.id, purpose="monitoring", cache_hit=cache_hit,
    )

    # ------------------------------------------------------
    # 7. Registrar ejecución
    # ------------------------------------------------------

    run = MonitorRun(
        actor_id=actor.id,
        status="running",
        days=days,
        minimum_magnitude=minimum,
    )

    db.add(run)
    db.flush()

    created = 0
    duplicates = 0
    ignored_by_rules = 0
    rules = db.scalars(select(AlertRule).where(AlertRule.enabled.is_(True)).order_by(AlertRule.created_at, AlertRule.id)).all()
    has_configured_rules = db.scalar(select(AlertRule.id).limit(1)) is not None


    # ------------------------------------------------------
    # 7. Procesar eventos observados
    # ------------------------------------------------------

    for event in events:

        event_id = str(event.external_id).strip()
        event_key = f"USGS:{event_id}"

        # Identificador inválido o demasiado largo.
        if not event_id or len(event_key) > 200:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Identificador USGS inválido. "
                    "No se completó el monitoreo."
                ),
            )

        # Evitar candidatos existentes.
        existing = db.get(
            MonitorCandidate,
            event_key,
        )

        if existing is not None:
            duplicates += 1
            continue

        # Si hay reglas configuradas, solo candidatos que coincidan con
        # alguna regla activa; no activar la regla implica no proponer avisos.
        selected_rule = None
        if has_configured_rules:
            for rule in rules:
                if not eligible(rule,event):
                    continue
                if rule.cooldown_minutes:
                    cutoff = end - timedelta(minutes=rule.cooldown_minutes)
                    latest = db.scalar(select(Alert.id).where(
                        Alert.rule_id == rule.id, Alert.created_at >= cutoff
                    ).limit(1))
                    if latest is not None:
                        continue
                selected_rule = rule
                break
            if selected_rule is None:
                ignored_by_rules += 1
                continue

        # --------------------------------------------------
        # 8. Construir contenido informativo
        # --------------------------------------------------

        place = (
            event.place or "Ubicación no especificada"
        ).strip()[:130]

        title = (
            f"Observación sísmica USGS "
            f"M{event.magnitude:.1f}"
        )[:140]

        body = (
            "CANDIDATO PARA REVISIÓN HUMANA. "
            f"USGS informa un evento observado en {place}; "
            f"magnitud {event.magnitude:.1f}, "
            f"profundidad {event.depth_km:.1f} km. "
            "No es una alerta temprana ni una predicción. "
            "Verificar antes de cualquier envío."
        )[:500]

        # --------------------------------------------------
        # 9. Crear candidato con protección transaccional
        # --------------------------------------------------

        try:
            with db.begin_nested():

                alert = Alert(
                    source="USGS",
                    rule_id=selected_rule.id if selected_rule else None,
                    external_event_id=event_id,
                    title=title,
                    body=body,
                    status="pending",
                    created_by=actor.id,
                )

                db.add(alert)
                db.flush()

                candidate = MonitorCandidate(
                    event_key=event_key,
                    alert_id=alert.id,
                )

                db.add(candidate)
                db.flush()

            created += 1

        except IntegrityError:
            # Otro proceso pudo crear el mismo candidato.
            duplicates += 1

    # ------------------------------------------------------
    # 10. Finalizar y auditar ejecución
    # ------------------------------------------------------

    run.examined = len(events)
    run.created = created
    run.duplicates = duplicates
    run.status = "completed"
    run.finished_at = datetime.now(timezone.utc)

    audit(
        db,
        "monitoring.scan",
        actor.id,
        "success",
        run.id,
    )

    db.commit()

    logger.info(
        "Monitoreo completado: examinados=%s, "
        "creados=%s, duplicados=%s",
        len(events),
        created,
        duplicates,
    )

    # ------------------------------------------------------
    # 11. Respuesta
    # ------------------------------------------------------

    return {
        "run_id": run.id,
        "status": run.status,
        "examined": len(events),
        "created": created,
        "duplicates": duplicates,
        "ignored_by_rules": ignored_by_rules,
        "source": "USGS",
        "push_sent": False,
        "requires_human_review": True,
        "cache_hit": cache_hit,
    }


# ==========================================================
# API - EJECUTAR MONITOREO
# ==========================================================

@router.post("/scan")
def scan_now(
    days: int = Query(
        default=1,
        ge=1,
        le=7,
    ),
    minimum: float = Query(
        default=4.5,
        ge=3.5,
        le=9.9,
    ),
    actor: User = Depends(
        require("alertas.configurar")
    ),
    db: Session = Depends(db_session),
):
    return scan(
        db,
        actor,
        days=days,
        minimum=minimum,
    )


# ==========================================================
# API - ESTADO DEL MONITOREO
# ==========================================================

@router.get("/status")
def status(
    actor: User = Depends(
        require("alertas.configurar")
    ),
):
    return {
        "enabled": settings.monitoring_enabled,
        "push_enabled": settings.push_enabled,
        "min_magnitude_default": 4.5,
        "maximum_days": MAX_DAYS,
        "automatic_send": False,
        "explanation": (
            "Solo candidatos pendientes. "
            "Aprobación humana obligatoria."
        ),
    }


# ==========================================================
# API - HISTORIAL DE EJECUCIONES
# ==========================================================

@router.get("/runs")
def list_runs(
    actor: User = Depends(
        require("alertas.configurar")
    ),
    db: Session = Depends(db_session),
):
    runs = db.scalars(
        select(MonitorRun)
        .order_by(MonitorRun.started_at.desc())
        .limit(30)
    ).all()

    return [
        {
            "id": run.id,
            "started_at": run.started_at,
            "finished_at": run.finished_at,
            "status": run.status,
            "examined": run.examined,
            "created": run.created,
            "duplicates": run.duplicates,
            "minimum_magnitude": run.minimum_magnitude,
            "days": run.days,
        }
        for run in runs
    ]
