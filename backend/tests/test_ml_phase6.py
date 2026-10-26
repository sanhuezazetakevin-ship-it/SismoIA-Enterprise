"""Fase 6: sin red, sin tocar Supabase y sin escribir modelos en disco."""
import os
os.environ['DATABASE_URL']='sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET']='local-test-secret-0123456789-sismoia-tests'
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from app.ml_lab import prepare, evaluate
from app.main import app


def records(n=100):
    start=datetime(2026,1,1,tzinfo=timezone.utc)
    out=[]
    for i in range(n):
        event=SimpleNamespace(id=str(i),external_id=f'ev-{i}',occurred_at=start+timedelta(hours=i),
              latitude=-17+(i%15)*0.7,longitude=-81+(i%10)*0.5,
              depth_km=10+(i%9)*10,magnitude=3.0 if i%3==0 else 4.6)
        out.append((event,'USGS'))
    return out

def test_preprocess_orders_and_deduplicates():
    rec=records(2)
    data,ex=prepare([rec[1],rec[0],rec[0]])
    assert len(data)==2 and ex['duplicate_source_id']==1
    assert data[0][0]<data[1][0]

def test_invalid_records_excluded():
    rec=records(2)
    rec[0][0].depth_km=None
    data,ex=prepare(rec)
    assert len(data)==1 and ex['missing_or_nonfinite']==1

def test_too_small_sample():
    with pytest.raises(ValueError,match='al menos'):
        evaluate(records(10))

def test_temporal_split_no_leakage():
    result=evaluate(records())
    assert result['n_train']==80 and result['n_test']==20
    assert result['train_end_utc']<result['test_start_utc']
    assert len(result['confusion_matrix'])==2

def test_deterministic_metrics_and_fingerprint():
    a=evaluate(records()); b=evaluate(records())
    assert a['metrics']==b['metrics'] and a['dataset_sha256']==b['dataset_sha256']
    assert a['baseline_metrics'] and 'f1_macro' in a['metrics']

def test_dataset_changes_fingerprint():
    rec=records(); a=evaluate(rec)['dataset_sha256']
    rec[0][0].magnitude=5.5
    assert a!=evaluate(rec)['dataset_sha256']

def test_one_class_rejected():
    rec=records()
    for event,_ in rec:event.magnitude=3.0
    with pytest.raises(ValueError,match='ambas categorías'):
        evaluate(rec)

def test_invalid_date_split_rejected():
    rec=records()
    for event,_ in rec:event.occurred_at=datetime(2026,1,1,tzinfo=timezone.utc)
    with pytest.raises(ValueError,match='fechas distintas'):
        evaluate(rec)

def test_anonymous_must_not_train():
    with TestClient(app) as client:
        assert client.post('/api/v1/ml/experiments/evaluate').status_code==401

def test_parameters_validated():
    with TestClient(app) as client:
        assert client.post('/api/v1/ml/experiments/evaluate?days=0&threshold=12').status_code==401
