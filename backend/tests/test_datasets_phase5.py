"""Fase 5: pruebas unitarias sin acceso a Supabase."""
import os
os.environ['DATABASE_URL']='sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET']='local-test-secret-0123456789-sismoia-tests'
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from fastapi.testclient import TestClient
from app.datasets import quality_flags,quality_report, row_data, fingerprint, csv_bytes
from app.main import app

def event(**overrides):
    values=dict(id='id1',external_id='source-1',occurred_at=datetime(2026,10,1,tzinfo=timezone.utc),latitude=-12.2,longitude=-77.1,magnitude=4.2,depth_km=45,place='Lima',source_url='https://example.org/e1')
    values.update(overrides)
    return SimpleNamespace(**values)

def test_valid_event():
    assert quality_flags(event())==[]

def test_missing_values():
    flags=quality_flags(event(magnitude=None,depth_km=None,place=None))
    assert set(flags)=={'missing_magnitude','missing_depth','missing_place'}

def test_outlier_review_not_removal():
    flags=quality_flags(event(magnitude=12,depth_km=900))
    assert 'magnitude_outlier_review' in flags and 'depth_outlier_review' in flags

def test_future_timestamp():
    assert 'future_timestamp' in quality_flags(event(occurred_at=datetime.now(timezone.utc)+timedelta(days=2)))

def test_empty_report():
    report=quality_report([])
    assert report['total']==0 and report['quality_rate_pct'] is None

def test_duplicates_and_quality():
    report=quality_report([(event(),'USGS'),(event(id='id2',magnitude=None),'USGS')])
    assert report['duplicate_source_ids']==1 and report['without_quality_flags']==1 and report['quality_rate_pct']==50

def test_stable_dataset_fingerprint():
    rows=[row_data(event(),'USGS')]
    assert fingerprint(rows)==fingerprint(rows) and fingerprint(rows)!=fingerprint([row_data(event(magnitude=5),'USGS')])

def test_csv_formula_injection_sanitized():
    data=csv_bytes([row_data(event(place='=1+2'),'USGS')]).decode('utf-8-sig')
    assert "'=1+2" in data

def test_csv_empty_has_header():
    assert 'event_id' in csv_bytes([]).decode('utf-8-sig')

def test_anonymous_denied():
    with TestClient(app) as client:
        assert client.get('/api/v1/datasets/quality').status_code==401
        assert client.get('/api/v1/datasets/export.csv').status_code==401
