"""Consultas de eventos y sincronización autorizada (sin alertas públicas)."""
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.auth import db_session, require
from app.models import DataSource, SeismicEvent, IngestionRun
from app.ingestion import sync_usgs, sync_usgs_history

router=APIRouter(prefix='/api/v1',tags=['Seismic events'])

def serialize(e, source):
    return {'id':e.id,'source':source,'external_id':e.external_id,'occurred_at':e.occurred_at.isoformat(),
        'latitude':e.latitude,'longitude':e.longitude,'magnitude':e.magnitude,'depth_km':e.depth_km,
        'place':e.place,'source_url':e.source_url,
        'source_updated_at':e.source_updated_at.isoformat() if e.source_updated_at else None}

@router.get('/events')
def events(page:int=Query(1,ge=1,le=100),page_size:int=Query(25,ge=1,le=100),
           min_magnitude:float|None=None,max_magnitude:float|None=None,
           from_date:datetime|None=None,to_date:datetime|None=None,
           user=Depends(require('eventos.ver'))):
    from datetime import timedelta,timezone
    from app.live_catalog import get_page, serialize as live_serialize
    end=to_date or datetime.now(timezone.utc)
    start=from_date or (end-timedelta(days=30))
    result=get_page(start=start,end=end,peru_only=True,minimum=min_magnitude,maximum=max_magnitude,
                    limit=page_size,offset=(page-1)*page_size+1)
    return {'total':result['total'] if result['total'] is not None else 0,'page':page,'page_size':page_size,
            'items':[live_serialize(e) for e in result['events']], 'source':'USGS FDSN',
            'queried_at':result['queried_at'],'cache_hit':result['cache_hit'], 'persisted':False}

@router.get('/events/geojson')
def event_geojson(limit:int=Query(500,ge=1,le=1000),user=Depends(require('eventos.ver'))):
    from datetime import timedelta,timezone
    from app.live_catalog import get_page, serialize as live_serialize
    end=datetime.now(timezone.utc)
    result=get_page(start=end-timedelta(days=30),end=end,limit=limit)
    return {'type':'FeatureCollection','features':[{'type':'Feature','id':e.id,
          'geometry':{'type':'Point','coordinates':[e.longitude,e.latitude]},
          'properties':live_serialize(e)} for e in result['events']]}

@router.get('/events/{event_id}')
def event_detail(event_id:str,user=Depends(require('eventos.ver'))):
    from datetime import timedelta,timezone
    from app.live_catalog import get_page,serialize as live_serialize
    if not event_id.startswith('usgs:'):
        raise HTTPException(404,'Evento no localizado en el catálogo actual')
    end=datetime.now(timezone.utc)
    result=get_page(start=end-timedelta(days=30),end=end,limit=1000)
    for e in result['events']:
        if e.id==event_id:return live_serialize(e)
    raise HTTPException(404,'Evento fuera de la ventana de consulta')

@router.get('/sources')
def sources(user=Depends(require('eventos.ver')),db:Session=Depends(db_session)):
    return [{'id':s.id,'name':s.name,'status':s.status,'last_sync_at':s.last_sync_at.isoformat() if s.last_sync_at else None} for s in db.scalars(select(DataSource).order_by(DataSource.name))]

@router.get('/ingestion/runs')
def ingestion_runs(user=Depends(require('fuentes.administrar')),db:Session=Depends(db_session)):
    rows=db.scalars(select(IngestionRun).order_by(IngestionRun.started_at.desc()).limit(50)).all()
    return [{'id':r.id,'source_id':r.source_id,'started_at':r.started_at.isoformat(),'status':r.status,'seen':r.records_seen,'inserted':r.records_inserted,'updated':r.records_updated,'skipped':r.records_skipped} for r in rows]

@router.post('/sources/usgs/sync')
def synchronize_usgs(days:int=Query(7,ge=1,le=30),limit:int=Query(250,ge=1,le=1000),
                     user=Depends(require('fuentes.administrar')),db:Session=Depends(db_session)):
    raise HTTPException(410, "Sincronización desactivada: SismoIA consulta USGS bajo demanda")
    try:return sync_usgs(db,days=days,limit=limit)
    except Exception as exc:raise HTTPException(502, 'No se pudo sincronizar USGS; consultar el historial de ejecuciones') from exc


@router.post('/sources/usgs/history')
def synchronize_usgs_history(start_date:date, end_date:date,
                            chunk_days:int=Query(14,ge=1,le=31),
                            page_size:int=Query(500,ge=1,le=1000),
                            max_pages:int=Query(10,ge=1,le=10),
                            user=Depends(require('fuentes.administrar')),
                            db:Session=Depends(db_session)):
    """Importa fechas históricas inclusivas, máximo 93 días por operación."""
    raise HTTPException(410, "Importación histórica desactivada: consulte los endpoints de lectura")
    try:
        return sync_usgs_history(db, start_date=start_date,end_date=end_date,
                                 chunk_days=chunk_days,page_size=page_size,max_pages=max_pages)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502,'Error en importación histórica; revise ingestion/runs') from exc
