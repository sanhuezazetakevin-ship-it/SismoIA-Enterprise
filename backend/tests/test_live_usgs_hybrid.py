"""Suite sin Internet ni Supabase para consultas externas sin persistencia."""
import os
os.environ['DATABASE_URL']='sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET']='test-secret-local-1234567890123456'
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
import httpx
import pytest
from fastapi import HTTPException
from app import live_catalog

NOW=datetime.now(timezone.utc)

def feature(i):
    return {'type':'Feature','id':str(i),'geometry':{'coordinates':[-76.,-12.,20.]},'properties':{
        'time':int((NOW-timedelta(hours=i)).timestamp()*1000),'mag':3.7,'place':'Perú',
        'url':'https://earthquake.usgs.gov/earthquakes/eventpage/'+str(i)}}

class Dummy:
    def __init__(self, responses):self.responses=iter(responses);self.calls=[]
    def get(self,url,params):
        self.calls.append(dict(params))
        val=next(self.responses)
        return httpx.Response(200,json=val,request=httpx.Request('GET',url))

def body(ids,total):return {'type':'FeatureCollection','features':[feature(i) for i in ids],'metadata':{'count':total}}

def test_live_page_normalizes_and_never_writes_db():
    http=Dummy([body([1,2],2)])
    result=live_catalog.get_page(start=NOW-timedelta(days=2),end=NOW,limit=2,client=http)
    assert [e.external_id for e in result['events']]==['1','2']
    assert result['events'][0].id=='usgs:1'
    assert http.calls[0]['minlatitude']==-22

def test_second_call_uses_cache():
    live_catalog._cache.clear()
    http=Dummy([body([3],1)])
    args=dict(start=NOW-timedelta(days=3),end=NOW,limit=31)
    assert live_catalog.get_page(**args,client=http)['cache_hit'] is False
    assert live_catalog.get_page(**args,client=http)['cache_hit'] is True
    assert len(http.calls)==1

def test_all_pages_collected(monkeypatch):
    http=Dummy([body([1,2],3),body([3],3)])
    monkeypatch.setattr(live_catalog,'MAX_PAGE_SIZE',2)
    live_catalog._cache.clear()
    result,meta=live_catalog.collect(days=4,max_events=10,client=http)
    assert len(result)==3 and http.calls[1]['offset']==3
    assert meta['source']=='USGS FDSN'

def test_large_catalog_rejected_instead_of_silent_truncation(monkeypatch):
    http=Dummy([body([1,2],10)])
    monkeypatch.setattr(live_catalog,'MAX_PAGE_SIZE',2)
    live_catalog._cache.clear()
    with pytest.raises(HTTPException) as exc:
        live_catalog.collect(days=6,max_events=2,client=http)
    assert exc.value.status_code==413

def test_error_is_sanitized():
    class ErrorClient:
        def get(self,*args,**kwargs):raise httpx.ConnectError('SECRET NETWORK DETAIL')
    with pytest.raises(HTTPException) as exc:
        live_catalog.get_page(start=NOW-timedelta(days=9),end=NOW,limit=25,client=ErrorClient())
    assert exc.value.status_code==502 and 'SECRET' not in str(exc.value.detail)

def test_invalid_ranges_rejected():
    with pytest.raises(HTTPException) as exc:
        live_catalog.get_page(start=NOW,end=NOW-timedelta(days=1))
    assert exc.value.status_code==422
