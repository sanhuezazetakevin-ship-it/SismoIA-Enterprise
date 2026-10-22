"""Pruebas Fase 3: SQLite temporal, HTTP USGS simulado, nunca Supabase."""
import os
os.environ['DATABASE_URL']='sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET']='local-test-secret-0123456789-sismoia-tests'
import uuid
from datetime import datetime, timezone
import pytest
import httpx
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from app.db import Base
from app.models import DataSource, SeismicEvent, IngestionRun
from app.ingestion import normalize_usgs, fetch_usgs, sync_usgs

FEATURE={'type':'Feature','id':'pe01234','geometry':{'type':'Point','coordinates':[-77.1,-12.1,35]},'properties':{'mag':4.8,'place':'Costa central de Perú','time':1720000000000,'updated':1720000100000,'url':'https://earthquake.usgs.gov/earthquakes/eventpage/pe01234'}}

def fake_client(features=None,status=200):
    def handler(request): return httpx.Response(status,json={'type':'FeatureCollection','features':features if features is not None else [FEATURE]})
    return httpx.Client(transport=httpx.MockTransport(handler))

def test_normalize_usgs_coordinates_utc():
    item=normalize_usgs(FEATURE)
    assert item['latitude']==-12.1 and item['longitude']==-77.1
    assert item['magnitude']==4.8 and item['occurred_at'].tzinfo==timezone.utc

def test_normalize_missing_id_rejected():
    with pytest.raises(ValueError):normalize_usgs({'properties':{'time':1720000000000},'geometry':{'coordinates':[-77,-12]}})

def test_normalize_negative_depth_tolerated():
    f={**FEATURE,'geometry':{'coordinates':[-77,-12,-1]}}
    assert normalize_usgs(f)['depth_km'] is None

def test_fetch_usgs_parameters_and_geojson():
    with fake_client() as client: assert len(fetch_usgs(client=client))==1

@pytest.mark.parametrize('days,limit',[(0,10),(7,0),(31,5),(1,1001)])
def test_reject_unbounded_fetch(days,limit):
    with pytest.raises(ValueError):fetch_usgs(days=days,limit=limit)

def test_ingestion_idempotent_and_revision():
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db, fake_client() as client:
        first=sync_usgs(db,client=client)
        second=sync_usgs(db,client=client)
        assert first['inserted']==1 and second['inserted']==0 and second['updated']==1
        assert db.scalar(select(func.count()).select_from(SeismicEvent))==1
        assert db.scalar(select(func.count()).select_from(IngestionRun))==2
        assert db.scalar(select(DataSource.name))=='USGS FDSN'
    engine.dispose()

def test_ingestion_invalid_event_is_skipped():
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db, fake_client([{'type':'Feature','id':None}]) as client:
        result=sync_usgs(db,client=client)
        assert result['skipped']==1 and result['inserted']==0
    engine.dispose()

def test_failure_log_is_persisted():
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db, fake_client(status=503) as client:
        with pytest.raises(httpx.HTTPStatusError):sync_usgs(db,client=client)
        assert db.scalar(select(IngestionRun.status))=='failed'
    engine.dispose()
