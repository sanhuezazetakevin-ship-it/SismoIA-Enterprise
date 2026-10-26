"""Estadísticas descriptivas observacionales; sin predicción sísmica."""
from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import db_session, require
from app.models import SeismicEvent, DataSource

router = APIRouter(prefix='/api/v1/analytics', tags=['Historical analytics'])

def in_bounds(lat, lon):
    return -19 <= lat <= 1 and -83 <= lon <= -68

def summarize(rows):
    events = [e for e in rows]
    mags = [e.magnitude for e in events if e.magnitude is not None]
    depths = [e.depth_km for e in events if e.depth_km is not None]
    by_day = Counter(e.occurred_at.date().isoformat() for e in events)
    mag_bins = {'< 3':0, '3–3.9':0, '4–4.9':0, '5–5.9':0, '≥ 6':0, 'sin dato':0}
    dep_bins = {'0–30':0, '30–70':0, '70–300':0, '> 300':0, 'sin dato':0}
    for e in events:
        m=e.magnitude
        mag_bins['sin dato' if m is None else '< 3' if m<3 else '3–3.9' if m<4 else '4–4.9' if m<5 else '5–5.9' if m<6 else '≥ 6']+=1
        d=e.depth_km
        dep_bins['sin dato' if d is None else '0–30' if d<=30 else '30–70' if d<=70 else '70–300' if d<=300 else '> 300']+=1
    return {'total':len(events),'mean_magnitude':round(sum(mags)/len(mags),2) if mags else None,
        'max_magnitude':max(mags) if mags else None,'mean_depth_km':round(sum(depths)/len(depths),1) if depths else None,
        'daily':[{'date':k,'count':v} for k,v in sorted(by_day.items())],
        'magnitudes':[{'range':k,'count':v} for k,v in mag_bins.items()],
        'depths':[{'range':k,'count':v} for k,v in dep_bins.items()]}

@router.get('/summary')
def summary(days:int=Query(30,ge=1,le=365),peru_only:bool=True,
            min_magnitude:float|None=None,max_magnitude:float|None=None,
            user=Depends(require('eventos.ver'))):
    from app.live_catalog import collect
    records,meta=collect(days=days,peru_only=peru_only,minimum=min_magnitude,maximum=max_magnitude)
    result=summarize([e for e,_ in records]);result.update({'days':days,'peru_only':peru_only,**meta})
    return result

@router.get('/map')
def map_events(days:int=Query(30,ge=1,le=365),limit:int=Query(500,ge=1,le=1000),
        peru_only:bool=True,min_magnitude:float|None=None,user=Depends(require('eventos.ver'))):
    from app.live_catalog import get_page
    end=datetime.now(timezone.utc)
    response=get_page(start=end-timedelta(days=days),end=end,peru_only=peru_only,minimum=min_magnitude,limit=limit)
    return {'period_days':days,'limit':limit,'sampled':response['total'] is None or response['total']>limit,
            'source':'USGS FDSN','queried_at':response['queried_at'],'cache_hit':response['cache_hit'],
            'items':[{'id':e.id,'lat':e.latitude,'lon':e.longitude,'magnitude':e.magnitude,
              'depth_km':e.depth_km,'occurred_at':e.occurred_at.isoformat(),'place':e.place,
              'source':'USGS FDSN','source_url':e.source_url} for e in response['events']]}
