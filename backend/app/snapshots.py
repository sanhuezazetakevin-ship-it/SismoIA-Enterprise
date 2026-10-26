"""Immutable USGS query/event snapshots. No bulk event sync or external pushes."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import db_session, require, audit
from app.snapshot_models import EventSnapshot, QuerySnapshot
from app.live_catalog import get_page, serialize

router = APIRouter(prefix="/api/v1/snapshots", tags=["USGS provenance"])
MAX_EVENTS = 1000

def canon(data):
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")

def digest(data):
    return hashlib.sha256(canon(data)).hexdigest()

def record_success(db, *, start, end, minimum, events, actor_id, purpose, cache_hit=False, total=None, skipped=0):
    if skipped or (total is not None and total != len(events)) or len(events) >= MAX_EVENTS:
        raise HTTPException(503, "Catálogo incompleto; no se archivaron eventos")
    rows = [serialize(e) for e in events]
    # Order is canonical to avoid arrival-order changes in content hash.
    rows.sort(key=lambda r: (r['occurred_at'], r['external_id']))
    if len({r['external_id'] for r in rows}) != len(rows):
        raise HTTPException(503, "Identificadores USGS duplicados en la misma consulta")
    snap = QuerySnapshot(purpose=purpose, period_start=start, period_end=end,
                         actor_id=actor_id, status="completed", event_count=len(rows),
                         skipped_count=0, result_hash=digest(rows),
                         query_params={"peru_only":True,"min_magnitude":minimum,"cache_hit":cache_hit,
                                       "limit":MAX_EVENTS,"start":start.isoformat(),"end":end.isoformat()})
    db.add(snap)
    db.flush()
    for row in rows:
        db.add(EventSnapshot(query_id=snap.id, external_id=row['external_id'],
                             occurred_at=datetime.fromisoformat(row['occurred_at']),
                             magnitude=row['magnitude'],depth_km=row['depth_km'],
                             latitude=row['latitude'],longitude=row['longitude'],
                             source_url=row['source_url'],event_hash=digest(row),data=row))
    db.flush()
    return snap

def record_failure(db, *, start, end, minimum, actor_id, purpose, failure):
    """Persist a failed USGS consultation, without storing URLs, tokens or raw provider errors.

    Only use after the caller rolls back any partial work. On database failure,
    propagate the error: a missing audit record must not be silently disguised.
    """
    if isinstance(failure, HTTPException):
        code = failure.status_code
        if code == 503:
            category = "INCOMPLETE_CATALOG"
        elif code == 502:
            category = "UPSTREAM_UNAVAILABLE_OR_INVALID"
        else:
            category = "QUERY_REJECTED"
    else:
        code = 502
        category = "UNEXPECTED_PROVIDER_ERROR"
    snap = QuerySnapshot(
        purpose=purpose, period_start=start, period_end=end,
        actor_id=actor_id, status="failed", event_count=0,
        skipped_count=0, result_hash=None,
        query_params={"peru_only": True, "min_magnitude": minimum,
                      "limit": MAX_EVENTS, "start": start.isoformat(),
                      "end": end.isoformat()},
        error_summary=f"{category} (HTTP {code})",
    )
    db.add(snap)
    db.flush()
    audit(db, 'snapshots.capture_failed' if purpose == 'manual' else 'monitoring.query_failed',
          actor_id, 'failure', snap.id)
    db.commit()
    return snap


@router.post('/capture')
def capture(days:int=Query(7,ge=1,le=30), minimum:float=Query(4.5,ge=0,le=9.9),
            actor=Depends(require('alertas.configurar')), db:Session=Depends(db_session)):
    end=datetime.now(timezone.utc); start=end-timedelta(days=days)
    try:
        page=get_page(start=start,end=end,peru_only=True,minimum=minimum,limit=MAX_EVENTS,offset=1)
        if page['skipped'] or (page['total'] is not None and page['total'] != len(page['events'])) or len(page['events'])>=MAX_EVENTS:
            raise HTTPException(503,'Catálogo incompleto; reduzca el período')
        snap=record_success(db,start=start,end=end,minimum=minimum,events=page['events'],
                           actor_id=actor.id,purpose='manual',cache_hit=page.get('cache_hit',False),
                           total=page['total'],skipped=page['skipped'])
        audit(db,'snapshots.capture',actor.id,'success',snap.id)
        db.commit()
        return {'id':snap.id,'event_count':snap.event_count,'sha256':snap.result_hash,'status':snap.status}
    except HTTPException as exc:
        db.rollback()
        if exc.status_code in (502,503):
            record_failure(db,start=start,end=end,minimum=minimum,
                           actor_id=actor.id,purpose='manual',failure=exc)
        raise
    except (ValueError, TypeError) as exc:
        db.rollback()
        record_failure(db,start=start,end=end,minimum=minimum,
                       actor_id=actor.id,purpose='manual',failure=exc)
        raise HTTPException(502,'Respuesta USGS inválida') from exc
    except Exception:
        db.rollback()
        raise

@router.get('')
def list_snapshots(actor=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    snaps=db.scalars(select(QuerySnapshot).order_by(QuerySnapshot.queried_at.desc()).limit(50)).all()
    return [{'id':s.id,'purpose':s.purpose,'queried_at':s.queried_at,'event_count':s.event_count,
             'sha256':s.result_hash,'status':s.status,'error_summary':s.error_summary} for s in snaps]

@router.get('/{snapshot_id}')
def get_snapshot(snapshot_id:str,actor=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    snap=db.get(QuerySnapshot,snapshot_id)
    if snap is None:raise HTTPException(404,'Snapshot inexistente')
    return {'id':snap.id,'purpose':snap.purpose,'queried_at':snap.queried_at,'period_start':snap.period_start,
            'period_end':snap.period_end,'params':snap.query_params,'sha256':snap.result_hash,
            'event_count':snap.event_count,'status':snap.status,'error_summary':snap.error_summary,
            'events':[e.data for e in db.scalars(select(EventSnapshot).where(EventSnapshot.query_id==snap.id).order_by(EventSnapshot.occurred_at)).all()]}
