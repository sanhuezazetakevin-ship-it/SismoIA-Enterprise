"""Phase 4 pure statistics and protected routes, without remote DB."""
import os
os.environ['DATABASE_URL']='sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET']='local-test-secret-0123456789-sismoia-tests'
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.db import Base
from app.main import app
from app.auth import db_session
from app.models import DataSource, SeismicEvent
from app.analytics import summarize

def ev(magnitude=None,depth_km=None,occurred_at=None):
    return SimpleNamespace(magnitude=magnitude,depth_km=depth_km,occurred_at=occurred_at or datetime(2026,1,1,tzinfo=timezone.utc))

def test_empty_statistics():
    out=summarize([])
    assert out['total']==0 and out['mean_magnitude'] is None and out['daily']==[]

def test_magnitude_depth_buckets():
    out=summarize([ev(2.8,12),ev(4.5,60),ev(6.1,350),ev()])
    assert out['total']==4 and out['max_magnitude']==6.1
    assert out['magnitudes'][0]['count']==1 and out['magnitudes'][-1]['count']==1
    assert out['depths'][-1]['count']==1

def test_sorted_daily_series():
    out=summarize([ev(3,10,datetime(2026,1,3,tzinfo=timezone.utc)),ev(4,20),ev(2,30)])
    assert out['daily']==[{'date':'2026-01-01','count':2},{'date':'2026-01-03','count':1}]

def test_routes_deny_anonymous():
    with TestClient(app) as client:
        assert client.get('/api/v1/analytics/summary').status_code==401
        assert client.get('/api/v1/analytics/map').status_code==401

def test_authentication_precedes_query_validation():
    with TestClient(app) as client:
        assert client.get('/api/v1/analytics/summary?days=366').status_code==401
        assert client.get('/api/v1/analytics/map?limit=1001').status_code==401
