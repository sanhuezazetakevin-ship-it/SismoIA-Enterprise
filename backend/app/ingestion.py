"""Fase 3: ingestión sísmica verificable. Sin pronósticos ni alertas automáticas."""
from datetime import date, datetime, timedelta, timezone
from typing import Any
import uuid
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import DataSource, SeismicEvent, IngestionRun

USGS_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
USGS_SOURCE = 'USGS FDSN'
# Rectángulo de consulta que incluye Perú y su margen oceánico cercano (no es un límite político).
PERU_BOX = {'minlatitude': -22, 'maxlatitude': 1, 'minlongitude': -84, 'maxlongitude': -68}

def normalize_usgs(feature: dict[str, Any]) -> dict[str, Any]:
    props = feature.get('properties') or {}
    coordinates = (feature.get('geometry') or {}).get('coordinates') or []
    external_id = feature.get('id')
    timestamp = props.get('time')
    if not external_id or timestamp is None or len(coordinates) < 2:
        raise ValueError('Evento sin identificador, fecha o coordenadas')
    lon, lat = float(coordinates[0]), float(coordinates[1])
    depth = float(coordinates[2]) if len(coordinates) > 2 and coordinates[2] is not None else None
    magnitude = float(props['mag']) if props.get('mag') is not None else None
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise ValueError('Coordenadas fuera de rango')
    # USGS puede publicar profundidades negativas próximas a superficie; almacenamos NULL
    # cuando no cumplen las restricciones del esquema y conservamos el original en el payload.
    if depth is not None and depth < 0: depth = None
    occurred_at = datetime.fromtimestamp(int(timestamp) / 1000, tz=timezone.utc)
    updated = props.get('updated')
    return {'external_id': str(external_id), 'occurred_at': occurred_at,
            'latitude': lat, 'longitude': lon, 'depth_km': depth, 'magnitude': magnitude,
            'place': (props.get('place') or '')[:255] or None,
            'source_url': (props.get('url') or '')[:1000] or None,
            'source_updated_at': datetime.fromtimestamp(int(updated)/1000, tz=timezone.utc) if updated is not None else None,
            'raw_payload': feature}

def fetch_usgs(*, days: int = 7, limit: int = 250, client: httpx.Client | None = None,
               start_at: datetime | None = None, end_at: datetime | None = None, offset: int = 1) -> list[dict]:
    if not (1 <= days <= 30 and 1 <= limit <= 1000):
        raise ValueError('days debe estar entre 1 y 30; limit entre 1 y 1000')
    now = datetime.now(timezone.utc)
    if (start_at is None) != (end_at is None):
        raise ValueError('Se requiere inicio y fin juntos')
    if start_at is not None:
        if start_at.tzinfo is None or end_at.tzinfo is None or not (start_at < end_at <= now + timedelta(days=1)):
            raise ValueError('Rango UTC inválido o futuro')
        if end_at - start_at > timedelta(days=31):
            raise ValueError('Cada solicitud USGS debe cubrir como máximo 31 días')
    if not (1 <= offset <= 10000):
        raise ValueError('Offset USGS fuera de rango')
    params = {'format': 'geojson', 'starttime': (start_at or now-timedelta(days=days)).isoformat(),
              'endtime': (end_at or now).isoformat(), 'orderby': 'time', 'limit': limit,
              'offset': offset, **PERU_BOX}
    def do_request(http):
        response = http.get(USGS_URL, params=params)
        response.raise_for_status()
        data = response.json()
        if data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list):
            raise ValueError('Respuesta de USGS no tiene formato GeoJSON esperado')
        return data['features']
    if client is not None: return do_request(client)
    with httpx.Client(timeout=20, follow_redirects=False, headers={'User-Agent':'SismoIA-Enterprise/0.3 (research prototype)'}) as http:
        return do_request(http)

def sync_usgs(db: Session, *, days: int = 7, limit: int = 250, client: httpx.Client | None = None):
    source = db.scalar(select(DataSource).where(DataSource.name == USGS_SOURCE))
    if source is None:
        source = DataSource(id=str(uuid.uuid4()), name=USGS_SOURCE, base_url=USGS_URL, status='enabled')
        db.add(source)
        db.flush()
    run = IngestionRun(id=str(uuid.uuid4()), source_id=source.id, started_at=datetime.now(timezone.utc), status='running')
    db.add(run)
    db.commit()
    inserted = updated = skipped = 0
    try:
        features = fetch_usgs(days=days, limit=limit, client=client)
        run.records_seen = len(features)
        for feature in features:
            try: fields = normalize_usgs(feature)
            except (ValueError, TypeError, OverflowError, OSError):
                skipped += 1
                continue
            existing = db.scalar(select(SeismicEvent).where(SeismicEvent.source_id==source.id,SeismicEvent.external_id==fields['external_id']))
            if existing is None:
                db.add(SeismicEvent(id=str(uuid.uuid4()),source_id=source.id,**fields))
                inserted += 1
            else:
                for key,value in fields.items(): setattr(existing,key,value)
                updated += 1
        run.records_inserted = inserted
        run.records_updated = updated
        run.records_skipped = skipped
        run.status = 'success'
        run.finished_at = datetime.now(timezone.utc)
        source.last_sync_at = run.finished_at
        db.commit()
    except Exception as exc:
        db.rollback()
        # Registrar error sin secretos ni parámetros de conexión.
        failed = db.get(IngestionRun,run.id)
        if failed:
            failed.status='failed'; failed.finished_at=datetime.now(timezone.utc)
            failed.error_summary=f'{type(exc).__name__}: consulta o procesamiento fallido'[:300]
            db.commit()
        raise
    return {'run_id':run.id,'source':source.name,'seen':run.records_seen,'inserted':inserted,'updated':updated,'skipped':skipped,'status':run.status}


def sync_usgs_history(db: Session, *, start_date: date, end_date: date,
                      chunk_days: int = 14, page_size: int = 500,
                      max_pages: int = 10, client: httpx.Client | None = None):
    """Importación histórica supervisada, con límites y commits por ventana.

    Fechas inclusivas; ante un error quedan registradas las ventanas completadas.
    No permite truncamiento silencioso: una ventana llena en todas sus páginas falla.
    """
    start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if start >= end or end > now + timedelta(days=1):
        raise ValueError('Fechas inválidas; el fin no puede ser posterior a hoy')
    if not (1 <= chunk_days <= 31 and 1 <= page_size <= 1000 and 1 <= max_pages <= 10):
        raise ValueError('chunk_days 1..31, page_size 1..1000, max_pages 1..10')
    if end - start > timedelta(days=93):
        raise ValueError('Máximo 93 días por ejecución; repita con otro intervalo')
    output = {'windows_completed':0,'seen':0,'inserted':0,'updated':0,'skipped':0,'runs':[]}
    source = db.scalar(select(DataSource).where(DataSource.name == USGS_SOURCE))
    if source is None:
        source = DataSource(id=str(uuid.uuid4()), name=USGS_SOURCE, base_url=USGS_URL, status='enabled')
        db.add(source)
        db.commit()
    while start < end:
        stop = min(start + timedelta(days=chunk_days), end)
        run = IngestionRun(id=str(uuid.uuid4()), source_id=source.id,
                           started_at=datetime.now(timezone.utc), status='running')
        db.add(run)
        db.commit()
        seen = inserted = updated = skipped = 0
        try:
            for page in range(max_pages):
                features = fetch_usgs(limit=page_size, client=client, start_at=start,
                                      end_at=stop, offset=1+page*page_size)
                seen += len(features)
                for feature in features:
                    try:
                        fields = normalize_usgs(feature)
                    except (ValueError, TypeError, OverflowError, OSError):
                        skipped += 1
                        continue
                    existing = db.scalar(select(SeismicEvent).where(
                        SeismicEvent.source_id == source.id,
                        SeismicEvent.external_id == fields['external_id']))
                    if existing is None:
                        db.add(SeismicEvent(id=str(uuid.uuid4()), source_id=source.id, **fields))
                        inserted += 1
                    else:
                        for k,v in fields.items(): setattr(existing,k,v)
                        updated += 1
                # Flush before next lookup; avoids duplicate IDs within a window.
                db.flush()
                if len(features) < page_size:
                    break
            else:
                # Without an extra request, a full last page can hide more data.
                raise ValueError('Ventana saturada: incremente max_pages o reduzca chunk_days')
            run.records_seen,run.records_inserted,run.records_updated,run.records_skipped = seen,inserted,updated,skipped
            run.status = 'success'
            run.finished_at = datetime.now(timezone.utc)
            source.last_sync_at = run.finished_at
            db.commit()
            output['windows_completed'] += 1
            for key,val in [('seen',seen),('inserted',inserted),('updated',updated),('skipped',skipped)]:
                output[key] += val
            output['runs'].append(run.id)
        except Exception as exc:
            db.rollback()
            failed = db.get(IngestionRun, run.id)
            if failed:
                failed.status='failed'
                failed.finished_at=datetime.now(timezone.utc)
                failed.error_summary=f'{type(exc).__name__}: ventana histórica fallida'[:300]
                db.commit()
            raise
        start = stop
    output['status']='success'
    return output
