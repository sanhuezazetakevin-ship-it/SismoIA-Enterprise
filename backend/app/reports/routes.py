"""RBAC-controlled bounded report downloads with persisted generation audit."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import db_session, require, audit
from app.auth_models import User
from app.report_models import ReportExport
from app.reports.service import rows_for,describe,MAX_ROWS
from app.reports.exporters import csv_bytes,pdf_bytes

router=APIRouter(prefix='/api/v1/reports',tags=['Reportes auditados'])
CATEGORIES={'events':'Eventos USGS','ml':'Experimentos ML','alerts':'Avisos internos'}

def utc(dt:datetime|None):
    if dt is None:return None
    if dt.tzinfo is None:raise HTTPException(422,'Las fechas requieren zona horaria explícita')
    return dt.astimezone(timezone.utc)

@router.get('/exports')
def history(actor:User=Depends(require('reportes.generar')),db:Session=Depends(db_session)):
    items=db.scalars(select(ReportExport).where(ReportExport.actor_id==actor.id).order_by(ReportExport.generated_at.desc()).limit(50)).all()
    return [{'id':r.id,'category':r.category,'format':r.format,'filters':r.filters,'rows_count':r.rows_count,'generated_at':r.generated_at} for r in items]

@router.get('/download')
def download(category:str=Query('events'),format:str=Query('csv'),start:datetime|None=None,end:datetime|None=None,
             actor:User=Depends(require('reportes.generar')),db:Session=Depends(db_session)):
    if category not in CATEGORIES or format not in ('csv','pdf'):
        raise HTTPException(422,'Categoría o formato no admitido')
    start,end=utc(start),utc(end)
    if start and end and start>end:raise HTTPException(422,'Rango de fechas inválido')
    headers,rows,note=rows_for(db,category,start,end)
    cut=datetime.now(timezone.utc)
    meta={'Proyecto':'SismoIA Enterprise','Reporte':CATEGORIES[category],'Generado UTC':cut.isoformat(),
          'Solicitante':actor.full_name,'Usuario ID':actor.id,'Fuente':'USGS (snapshots guardados)' if category=='events' else 'PostgreSQL / SismoIA',
          'Fecha inicio UTC':start.isoformat() if start else 'Sin filtro','Fecha fin UTC':end.isoformat() if end else 'Sin filtro',
          'Filas':len(rows),'Limite de filas':MAX_ROWS,'Alcance':note}
    contents=csv_bytes(headers,rows,meta) if format=='csv' else pdf_bytes(headers,rows,meta,describe(rows,category))
    r=ReportExport(actor_id=actor.id,category=category,format=format,filters={'start':meta['Fecha inicio UTC'],'end':meta['Fecha fin UTC']},rows_count=len(rows))
    db.add(r);db.flush();audit(db,'reports.export',actor.id,'success',r.id);db.commit()
    return Response(contents,media_type='text/csv; charset=utf-8' if format=='csv' else 'application/pdf',headers={
        'Content-Disposition':f'attachment; filename="sismoia_{category}_{cut.strftime("%Y%m%d_%H%M%S")}.{format}"',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
