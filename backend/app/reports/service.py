"""Queries are bounded, deterministic, read-only and from persisted data."""
from collections import Counter
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.snapshot_models import EventSnapshot, QuerySnapshot
from app.ml_registry_models import DatasetVersion, MLStudy
from app.alert_models import Alert, AlertReview

MAX_ROWS=1000

def rows_for(db:Session,category:str,start:datetime|None,end:datetime|None):
    if category=='events':
        stmt=(select(EventSnapshot,QuerySnapshot)
              .join(QuerySnapshot,EventSnapshot.query_id==QuerySnapshot.id)
              .where(QuerySnapshot.status=='completed')
              .order_by(EventSnapshot.occurred_at.desc(),EventSnapshot.id.desc()))
        if start is not None: stmt=stmt.where(EventSnapshot.occurred_at>=start)
        if end is not None: stmt=stmt.where(EventSnapshot.occurred_at<=end)
        records=db.execute(stmt.limit(MAX_ROWS)).all()
        cols=['evento_id','fecha_utc','magnitud','profundidad_km','latitud','longitud','fuente','url_fuente','consulta_utc','snapshot_id']
        rows=[[e.external_id,e.occurred_at,e.magnitude,e.depth_km,e.latitude,e.longitude,s.source,e.source_url,s.queried_at,s.id] for e,s in records]
        return cols, rows, 'Eventos historicos guardados en snapshots USGS; no equivale al catalogo completo en vivo.'
    if category=='ml':
        stmt=(select(MLStudy,DatasetVersion).join(DatasetVersion,MLStudy.dataset_id==DatasetVersion.id)
              .order_by(MLStudy.created_at.desc(),MLStudy.id.desc()))
        if start is not None: stmt=stmt.where(MLStudy.created_at>=start)
        if end is not None: stmt=stmt.where(MLStudy.created_at<=end)
        records=db.execute(stmt.limit(MAX_ROWS)).all()
        cols=['experimento_id','fecha_utc','modelo','algoritmo','dataset_id','sha256_dataset','registros_dataset','metricas','limitaciones']
        rows=[[s.id,s.created_at,s.kind,s.algorithm,d.id,d.content_sha256,d.row_count,s.metrics,s.limitations] for s,d in records]
        return cols,rows,'Resultados ML retrospectivos y experimentales; no son predicciones de terremotos.'
    if category=='alerts':
        stmt=select(Alert).order_by(Alert.created_at.desc(),Alert.id.desc())
        if start is not None: stmt=stmt.where(Alert.created_at>=start)
        if end is not None: stmt=stmt.where(Alert.created_at<=end)
        records=db.scalars(stmt.limit(MAX_ROWS)).all()
        cols=['aviso_id','evento_externo','fuente','regla_id','titulo','estado','fecha_creacion_utc','aprobado_por','fecha_aprobacion_utc','fecha_envio_utc']
        rows=[[a.id,a.external_event_id,a.source,a.rule_id,a.title,a.status,a.created_at,a.approved_by,a.approved_at,a.sent_at] for a in records]
        return cols,rows,'Registro interno de avisos; envio registrado no confirma recepcion ni lectura.'
    raise ValueError('Tipo de reporte desconocido')

def describe(rows:list[list],category:str):
    if category=='events':
        return [('Eventos en reporte',str(len(rows))),('Magnitud promedio',f'{sum(float(x[2]) for x in rows if x[2] is not None)/max(1,sum(x[2] is not None for x in rows)):.2f}')]
    if category=='ml': return [('Experimentos registrados',str(len(rows))),('Datasets distintos',str(len(set(x[4] for x in rows))))]
    counts=Counter(str(x[5]) for x in rows)
    return [('Avisos registrados',str(len(rows))),*[(f'Estado {k}',str(v)) for k,v in sorted(counts.items())]]
