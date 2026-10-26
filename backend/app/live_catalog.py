"""Catálogo USGS bajo demanda: no escribe eventos en PostgreSQL.

La caché es por proceso, acotada y de vida breve; no ofrece disponibilidad garantizada.
"""
from datetime import datetime, timedelta, timezone
from threading import RLock
from time import monotonic
from types import SimpleNamespace
import hashlib
import json
import httpx
from fastapi import HTTPException
from app.ingestion import USGS_URL, PERU_BOX, normalize_usgs

_lock = RLock()
_cache = {}
TTL_SECONDS = 300
MAX_CACHE_KEYS = 64
MAX_PAGE_SIZE = 1000
MAX_AGGREGATE = 5000


def _utc(dt):
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _params(start, end, peru_only, minimum, maximum, limit, offset):
    params={'format':'geojson','starttime':_utc(start).isoformat(),'endtime':_utc(end).isoformat(),
            'orderby':'time','limit':limit,'offset':offset}
    if peru_only:params.update(PERU_BOX)
    if minimum is not None:params['minmagnitude']=minimum
    if maximum is not None:params['maxmagnitude']=maximum
    return params


def get_page(*, start, end, peru_only=True, minimum=None, maximum=None, limit=250, offset=1, client=None):
    if _utc(start)>=_utc(end) or end-start>timedelta(days=3660):
        raise HTTPException(422,'Rango temporal inválido')
    if maximum is not None and minimum is not None and minimum>maximum:
        raise HTTPException(422,'Rango de magnitud inválido')
    if not (1<=limit<=MAX_PAGE_SIZE and 1<=offset<=100000):
        raise HTTPException(422,'Límite o desplazamiento inválido')
    params=_params(start,end,peru_only,minimum,maximum,limit,offset)
    key=hashlib.sha256(json.dumps(params,sort_keys=True).encode()).hexdigest()
    now=monotonic()
    with _lock:
        cached=_cache.get(key)
        if cached and now-cached[0]<TTL_SECONDS:
            return {**cached[1], 'cache_hit': True}
    try:
        if client is None:
            with httpx.Client(timeout=25, follow_redirects=False, headers={'User-Agent':'SismoIA-Enterprise/0.7 (educational project)'}) as http:
                res=http.get(USGS_URL,params=params)
        else:res=client.get(USGS_URL,params=params)
        res.raise_for_status()
        body=res.json()
        if body.get('type')!='FeatureCollection' or not isinstance(body.get('features'),list):
            raise ValueError('Formato USGS inválido')
        metadata=body.get('metadata') or {}
        total=metadata.get('count')
        if not isinstance(total,int) or total<0:total=None
        events=[]; skipped=0
        for feature in body['features']:
            try:
                d=normalize_usgs(feature)
                events.append(SimpleNamespace(id='usgs:'+d['external_id'],**{k:v for k,v in d.items() if k!='raw_payload'}))
            except (TypeError, ValueError, OverflowError, OSError):skipped+=1
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise HTTPException(502,'USGS no disponible o respuesta inválida; reintente más tarde') from exc
    result={'events':events,'total':total,'skipped':skipped,'queried_at':datetime.now(timezone.utc).isoformat(), 'cache_hit':False}
    with _lock:
        if len(_cache)>=MAX_CACHE_KEYS:
            oldest=min(_cache,key=lambda k:_cache[k][0]);_cache.pop(oldest,None)
        _cache[key]=(monotonic(),result)
    return result


def collect(*, days, peru_only=True, minimum=None, maximum=None, max_events=MAX_AGGREGATE, client=None):
    """Recoge páginas completas o rechaza resultados truncados: nunca confundir muestra con catálogo total."""
    end=datetime.now(timezone.utc)
    start=end-timedelta(days=days)
    records=[]; meta=None; offset=1
    while True:
        limit=min(MAX_PAGE_SIZE,max_events-len(records))
        if limit<=0:raise HTTPException(413,'Demasiados eventos para esta consulta; reduzca el período o aplique magnitud mínima')
        page=get_page(start=start,end=end,peru_only=peru_only,minimum=minimum,maximum=maximum,limit=limit,offset=offset,client=client)
        if meta is None:meta=page
        batch=page['events']; records.extend((e,'USGS FDSN') for e in batch)
        # Si hay errores de normalización, el siguiente offset debe seguir la paginación cruda.
        # Para seguridad, no avanzar paginación con eventos omitidos: no podemos inferir conteos.
        if page['skipped']:
            raise HTTPException(502,'USGS devolvió eventos no normalizables; catálogo incompleto')
        if page['total'] is None:
            if len(batch)<limit:break
        elif offset+limit-1>=page['total']:break
        if len(batch)<limit:break
        offset+=limit
        if len(records)>=max_events:raise HTTPException(413,'Catálogo demasiado grande; reduzca el período o aplique magnitud mínima')
    return records, {'source':'USGS FDSN','queried_at':meta['queried_at'] if meta else None,'cache_hit':meta['cache_hit'] if meta else False,
                     'scope':'Consulta USGS bajo demanda; sin persistencia de eventos'}


def serialize(e, source='USGS FDSN'):
    return {'id':e.id,'source':source,'external_id':e.external_id,'occurred_at':e.occurred_at.isoformat(),
            'latitude':e.latitude,'longitude':e.longitude,'magnitude':e.magnitude,'depth_km':e.depth_km,
            'place':e.place,'source_url':e.source_url,
            'source_updated_at':e.source_updated_at.isoformat() if e.source_updated_at else None}
