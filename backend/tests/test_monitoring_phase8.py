"""Phase 8 isolated tests, no external HTTP or real Supabase access."""
from datetime import datetime,timezone
from types import SimpleNamespace
from sqlalchemy import select,func
from tests.test_security_automated import setup_api,login
from app.alert_models import Alert
from app.monitoring_models import MonitorCandidate,MonitorRun
from app.config import settings
import app.monitoring as monitoring


def fake_page(*,start,end,peru_only,minimum,limit,offset):
    assert peru_only and limit==1000 and offset==1
    return {'events':[SimpleNamespace(id='usgs:p8-event', external_id='p8-event',place='Lima, Peru',magnitude=5.1,depth_km=21.2,occurred_at=datetime(2026,1,1,tzinfo=timezone.utc),latitude=-12.0,longitude=-77.0,source_url='https://earthquake.usgs.gov/earthquakes/eventpage/p8-event',source_updated_at=None)],
            'total':1,'skipped':0,'cache_hit':False}

def test_disabled_by_default_and_no_usgs_request(setup_api,monkeypatch):
    c,_=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',False)
    monkeypatch.setattr(monitoring,'get_page',lambda **kw:(_ for _ in ()).throw(AssertionError('called')))
    h=login(c,'ADMINISTRADOR')
    assert c.post('/api/v1/monitoring/scan',headers=h).status_code==503
    assert c.get('/api/v1/monitoring/status',headers=h).json()['enabled'] is False

def test_permissions(setup_api,monkeypatch):
    c,_=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    assert c.post('/api/v1/monitoring/scan').status_code==401
    assert c.post('/api/v1/monitoring/scan',headers=login(c,'CONSULTA')).status_code==403
    assert c.get('/api/v1/monitoring/runs',headers=login(c,'CONSULTA')).status_code==403
    assert c.get('/api/v1/monitoring/status',headers=login(c,'ADMINISTRADOR')).status_code==200

def test_pending_dedup_and_never_push(setup_api,monkeypatch):
    c,S=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    monkeypatch.setattr(settings,'push_enabled',True)
    monkeypatch.setattr(monitoring,'get_page',fake_page)
    import app.alerts as alerts
    monkeypatch.setattr(alerts,'send_informational_push',lambda *args: (_ for _ in ()).throw(AssertionError('PUSH was called')))
    h=login(c,'ADMINISTRADOR')
    r=c.post('/api/v1/monitoring/scan',headers=h)
    assert r.status_code==200,r.text
    assert r.json()['created']==1 and r.json()['push_sent'] is False
    r=c.post('/api/v1/monitoring/scan',headers=h)
    assert r.status_code==200,r.text
    assert r.json()['created']==0 and r.json()['duplicates']==1
    with S() as db:
        assert db.scalar(select(func.count()).select_from(MonitorCandidate))==1
        assert db.scalar(select(func.count()).select_from(MonitorRun))==2
        a=db.scalar(select(Alert).where(Alert.external_event_id=='p8-event'))
        assert a.status=='pending' and 'No es una alerta temprana' in a.body
    assert c.post(f'/api/v1/alerts/{a.id}/approve',headers=h,json={'note':'No puede autoaprobarse'}).status_code==409
    other=login(c,'OPERADOR_ALERTAS')
    assert c.post(f'/api/v1/alerts/{a.id}/approve',headers=other,json={"note":"Aprobación tras verificar evidencia"}).status_code==200

def test_truncation_no_partial_writes(setup_api,monkeypatch):
    c,S=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    monkeypatch.setattr(monitoring,'get_page',lambda **kw:{**fake_page(**kw),'total':1001})
    h=login(c,'ADMINISTRADOR')
    assert c.post('/api/v1/monitoring/scan',headers=h).status_code==503
    with S() as db:
        assert db.scalar(select(func.count()).select_from(MonitorCandidate))==0

def test_invalid_parameters(setup_api,monkeypatch):
    c,_=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    h=login(c,'ADMINISTRADOR')
    assert c.post('/api/v1/monitoring/scan?days=8',headers=h).status_code==422
    assert c.post('/api/v1/monitoring/scan?minimum=2.0',headers=h).status_code==422


def test_monitoring_provider_failure_creates_auditable_snapshot(setup_api,monkeypatch):
    from fastapi import HTTPException
    from app.snapshot_models import QuerySnapshot, EventSnapshot
    c,S=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    def unavailable(**kwargs):
        raise HTTPException(502,'Internal upstream secret must not be persisted')
    monkeypatch.setattr(monitoring,'get_page',unavailable)
    auth=login(c,'ADMINISTRADOR')
    response=c.post('/api/v1/monitoring/scan',headers=auth)
    assert response.status_code==502
    with S() as db:
        row=db.scalar(select(QuerySnapshot))
        assert row is not None and row.status=='failed' and row.purpose=='monitoring'
        assert row.error_summary=='UPSTREAM_UNAVAILABLE_OR_INVALID (HTTP 502)'
        assert 'secret' not in row.error_summary
        assert db.scalar(select(func.count()).select_from(EventSnapshot))==0
        assert db.scalar(select(func.count()).select_from(MonitorCandidate))==0
