"""Evidence and security tests: isolated DB, no Supabase and no outbound USGS."""
from datetime import datetime, timezone
from types import SimpleNamespace
from sqlalchemy import select, func
from tests.test_security_automated import setup_api, login
from app.snapshot_models import QuerySnapshot, EventSnapshot
import app.snapshots as snapshots


def sample_event(event_id='sample-event'):
    return SimpleNamespace(
        id=f'usgs:{event_id}', external_id=event_id,
        occurred_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        latitude=-12.2, longitude=-77.1, magnitude=5.2, depth_km=30.0,
        place='Peru, sample', source_url='https://earthquake.usgs.gov',
        source_updated_at=None,
    )


def mock_page(**kwargs):
    return {'events':[sample_event()], 'total':1, 'skipped':0, 'cache_hit':False}


def test_snapshot_capture_and_retrieve(setup_api, monkeypatch):
    client, Session = setup_api
    monkeypatch.setattr(snapshots, 'get_page', mock_page)
    admin=login(client,'ADMINISTRADOR')
    created=client.post('/api/v1/snapshots/capture?days=7&minimum=4.5',headers=admin)
    assert created.status_code==200, created.text
    body=created.json()
    assert body['event_count']==1 and len(body['sha256'])==64
    listing=client.get('/api/v1/snapshots',headers=admin)
    assert listing.status_code==200 and listing.json()[0]['id']==body['id']
    detail=client.get('/api/v1/snapshots/'+body['id'],headers=admin)
    assert detail.status_code==200
    assert detail.json()['events'][0]['external_id']=='sample-event'
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(QuerySnapshot))==1
        assert db.scalar(select(func.count()).select_from(EventSnapshot))==1


def test_snapshot_permission_and_missing(setup_api):
    client,_=setup_api
    assert client.get('/api/v1/snapshots').status_code==401
    assert client.post('/api/v1/snapshots/capture',headers=login(client,'CONSULTA')).status_code==403
    admin=login(client,'ADMINISTRADOR')
    assert client.get('/api/v1/snapshots/missing',headers=admin).status_code==404


def test_incomplete_catalog_not_stored(setup_api,monkeypatch):
    client,Session=setup_api
    monkeypatch.setattr(snapshots,'get_page',lambda **k: {**mock_page(**k),'total':2})
    r=client.post('/api/v1/snapshots/capture',headers=login(client,'ADMINISTRADOR'))
    assert r.status_code==503
    with Session() as db:
        failures=db.scalars(select(QuerySnapshot)).all()
        assert len(failures)==1
        assert failures[0].status=='failed'
        assert failures[0].result_hash is None
        assert failures[0].error_summary=='INCOMPLETE_CATALOG (HTTP 503)'
        assert db.scalar(select(func.count()).select_from(EventSnapshot))==0


def test_canonical_hash_is_order_independent():
    from app.snapshots import digest
    assert digest({'a':1,'b':2})==digest({'b':2,'a':1})


def test_usgs_failure_persisted_and_visible(setup_api,monkeypatch):
    from fastapi import HTTPException
    client,Session=setup_api
    def failed(**kwargs):
        raise HTTPException(502,'Sensitive upstream debug details')
    monkeypatch.setattr(snapshots,'get_page',failed)
    admin=login(client,'ADMINISTRADOR')
    r=client.post('/api/v1/snapshots/capture',headers=admin)
    assert r.status_code==502
    rows=client.get('/api/v1/snapshots',headers=admin).json()
    assert len(rows)==1 and rows[0]['status']=='failed'
    assert 'Sensitive' not in str(rows)
    detail=client.get('/api/v1/snapshots/'+rows[0]['id'],headers=admin).json()
    assert detail['events']==[] and detail['sha256'] is None
    assert detail['error_summary']=='UPSTREAM_UNAVAILABLE_OR_INVALID (HTTP 502)'
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(EventSnapshot))==0


def test_no_failure_snapshot_for_unauthorized_user(setup_api):
    client,Session=setup_api
    assert client.post('/api/v1/snapshots/capture').status_code==401
    assert client.post('/api/v1/snapshots/capture',headers=login(client,'CONSULTA')).status_code==403
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(QuerySnapshot))==0
