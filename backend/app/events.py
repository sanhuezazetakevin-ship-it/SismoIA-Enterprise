"""Consultas de eventos y sincronización autorizada (sin alertas públicas)."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.auth import db_session, require
from app.models import DataSource, SeismicEvent, IngestionRun
from app.ingestion import sync_usgs

router=APIRouter(prefix='/api/v1',tags=['Seismic events'])

def serialize(e, source):
    return {'id':e.id,'source':source,'external_id':e.external_id,'occurred_at':e.occurred_at.isoformat(),
        'latitude':e.latitude,'longitude':e.longitude,'magnitude':e.magnitude,'depth_km':e.depth_km,
        'place':e.place,'source_url':e.source_url,
        'source_updated_at':e.source_updated_at.isoformat() if e.source_updated_at else None}

@router.get('/events')
def events(page:int=Query(1,ge=1),page_size:int=Query(25,ge=1,le=100),
           min_magnitude:float|None=None,max_magnitude:float|None=None,
           from_date:datetime|None=None,to_date:datetime|None=None,
           user=Depends(require('eventos.ver')),db:Session=Depends(db_session)):
    if min_magnitude is not None and max_magnitude is not None and min_magnitude>max_magnitude:
        raise HTTPException(422,'Rango de magnitud inválido')
    if from_date and to_date and from_date>to_date:raise HTTPException(422,'Rango temporal inválido')
    query=select(SeismicEvent,DataSource.name).join(DataSource,DataSource.id==SeismicEvent.source_id)
    if min_magnitude is not None:query=query.where(SeismicEvent.magnitude>=min_magnitude)
    if max_magnitude is not None:query=query.where(SeismicEvent.magnitude<=max_magnitude)
    if from_date:query=query.where(SeismicEvent.occurred_at>=from_date)
    if to_date:query=query.where(SeismicEvent.occurred_at<=to_date)
    total=db.scalar(select(func.count()).select_from(query.subquery())) or 0
    records=db.execute(query.order_by(SeismicEvent.occurred_at.desc()).offset((page-1)*page_size).limit(page_size)).all()
    return {'total':total,'page':page,'page_size':page_size,'items':[serialize(e,name) for e,name in records]}

@router.get('/events/geojson')
def event_geojson(limit:int=Query(500,ge=1,le=1000),user=Depends(require('eventos.ver')),db:Session=Depends(db_session)):
    records=db.execute(select(SeismicEvent,DataSource.name).join(DataSource,SeismicEvent.source_id==DataSource.id).order_by(SeismicEvent.occurred_at.desc()).limit(limit)).all()
    return {'type':'FeatureCollection','features':[{'type':'Feature','id':e.id,'geometry':{'type':'Point','coordinates':[e.longitude,e.latitude]},'properties':serialize(e,name)} for e,name in records]}

@router.get('/events/{event_id}')
def event_detail(event_id:str,user=Depends(require('eventos.ver')),db:Session=Depends(db_session)):
    row=db.execute(select(SeismicEvent,DataSource.name).join(DataSource).where(SeismicEvent.id==event_id)).first()
    if not row:raise HTTPException(404,'Evento no encontrado')
    return serialize(*row)

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
    try:return sync_usgs(db,days=days,limit=limit)
    except Exception as exc:raise HTTPException(502, 'No se pudo sincronizar USGS; consultar el historial de ejecuciones') from exc
