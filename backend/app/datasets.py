"""Fase 5: perfiles de calidad y datasets reproducibles del catálogo observado.

No es una certificación científica ni un pronóstico. No escribe en la BD.
"""
import csv
import hashlib
import io
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import db_session, require
from app.models import SeismicEvent, DataSource

router = APIRouter(prefix='/api/v1/datasets', tags=['Dataset quality'])
MAX_ROWS = 10000
COLUMNS = ('event_id','source','external_id','occurred_at_utc','latitude','longitude','magnitude','depth_km','place','source_url')

def quality_flags(event):
    flags=[]
    if event.magnitude is None: flags.append('missing_magnitude')
    elif not (-2.0 <= event.magnitude <= 10.0): flags.append('magnitude_outlier_review')
    if event.depth_km is None: flags.append('missing_depth')
    elif event.depth_km > 750: flags.append('depth_outlier_review')
    if event.latitude is None or not (-90 <= event.latitude <= 90): flags.append('invalid_latitude')
    if event.longitude is None or not (-180 <= event.longitude <= 180): flags.append('invalid_longitude')
    if event.occurred_at is None: flags.append('missing_timestamp')
    elif event.occurred_at.replace(tzinfo=event.occurred_at.tzinfo or timezone.utc) > datetime.now(timezone.utc)+timedelta(minutes=5):
        flags.append('future_timestamp')
    if not event.place: flags.append('missing_place')
    return flags

def quality_report(records):
    entries=list(records)
    counts=Counter()
    missing=Counter()
    seen=set()
    duplicates=0
    usable=0
    for event, source in entries:
        flags=quality_flags(event)
        counts.update(flags)
        for name, value in [('magnitude',event.magnitude),('depth_km',event.depth_km),('place',event.place)]:
            if value is None or value=='':missing[name]+=1
        key=(source,event.external_id)
        if key in seen:duplicates+=1
        seen.add(key)
        if not flags:usable+=1
    n=len(entries)
    return {'total':n,'without_quality_flags':usable,'quality_rate_pct':round(100*usable/n,2) if n else None,
            'flag_counts':dict(sorted(counts.items())), 'missing_fields':dict(sorted(missing.items())),
            'duplicate_source_ids':duplicates,
            'interpretation':'Control heurístico de calidad; los valores atípicos requieren revisión, no eliminación automática.'}

def row_data(event, source):
    return dict(zip(COLUMNS, (event.id,source,event.external_id,event.occurred_at.isoformat() if event.occurred_at else '',
                                  event.latitude,event.longitude,event.magnitude,event.depth_km,event.place,event.source_url)))

def fingerprint(rows):
    digest=hashlib.sha256()
    for row in rows:
        digest.update(json.dumps(row,sort_keys=True,ensure_ascii=False,default=str,separators=(',',':')).encode('utf-8'))
        digest.update(b'\n')
    return digest.hexdigest()

def clean_csv_value(value):
    s='' if value is None else str(value)
    if s.startswith(('=','+','-','@','\t','\r','\n')) and not s.lstrip().replace('.','',1).replace('-','',1).isdigit():
        return "'"+s
    return s

def csv_bytes(rows):
    output=io.StringIO(newline='')
    writer=csv.DictWriter(output,fieldnames=COLUMNS,lineterminator='\r\n')
    writer.writeheader()
    for row in rows:writer.writerow({k:clean_csv_value(v) for k,v in row.items()})
    return output.getvalue().encode('utf-8-sig')

def fetch_records(db,days,peru_only,min_magnitude):
    from app.live_catalog import collect
    records,_=collect(days=days,peru_only=peru_only,minimum=min_magnitude,max_events=MAX_ROWS)
    return sorted(records,key=lambda r:(r[0].occurred_at,r[0].id))

@router.get('/quality')
def get_quality(days:int=Query(30,ge=1,le=365),peru_only:bool=True,
                min_magnitude:float|None=None,user=Depends(require('eventos.ver')),db:Session=Depends(db_session)):
    records=fetch_records(db,days,peru_only,min_magnitude)
    report=quality_report(records)
    rows=[row_data(e,source) for e,source in records]
    report.update({'days':days,'peru_only':peru_only,'min_magnitude':min_magnitude,
                   'sha256':fingerprint(rows),'columns':list(COLUMNS),
                   'method':'SHA-256 sobre filas canónicas ordenadas por fecha e ID; varía cuando cambian los datos.',
                   'scope':'Consulta USGS en vivo; no implica cobertura exhaustiva del catálogo nacional.'})
    return report

@router.get('/export.csv')
def export_csv(days:int=Query(30,ge=1,le=365),peru_only:bool=True,
               min_magnitude:float|None=None,user=Depends(require('reportes.generar')),db:Session=Depends(db_session)):
    records=fetch_records(db,days,peru_only,min_magnitude)
    rows=[row_data(e,source) for e,source in records]
    return Response(csv_bytes(rows),media_type='text/csv; charset=utf-8',headers={
        'Content-Disposition':'attachment; filename="sismoia_dataset.csv"',
        'X-Dataset-SHA256':fingerprint(rows),'Cache-Control':'no-store'})
