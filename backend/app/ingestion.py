"""Fase 3: ingestión sísmica verificable. Sin pronósticos ni alertas automáticas."""
from datetime import datetime, timedelta, timezone
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

def fetch_usgs(*, days: int = 7, limit: int = 250, client: httpx.Client | None = None) -> list[dict]:
    if not (1 <= days <= 30 and 1 <= limit <= 1000):
        raise ValueError('days debe estar entre 1 y 30; limit entre 1 y 1000')
    now = datetime.now(timezone.utc)
    params = {'format': 'geojson', 'starttime': (now-timedelta(days=days)).isoformat(),
              'endtime': now.isoformat(), 'orderby': 'time', 'limit': limit, **PERU_BOX}
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
