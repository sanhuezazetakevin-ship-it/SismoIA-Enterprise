"""Tests for rule configuration and supervised candidate selection."""
from datetime import datetime, timezone
from types import SimpleNamespace
from sqlalchemy import select
from tests.test_security_automated import setup_api,login
from app.config import settings
from app.alert_models import Alert,AlertRule
import app.monitoring as monitoring


def sample_page(**kw):
    def event(i,mag,lat,lon):
        return SimpleNamespace(id=f'USGS:candidate-{i}',external_id=f'candidate-{i}', place='Peru',magnitude=mag,latitude=lat,longitude=lon,depth_km=14.0,occurred_at=datetime(2026,1,1,tzinfo=timezone.utc),source_url=f'https://earthquake.usgs.gov/earthquakes/eventpage/candidate-{i}',source_updated_at=None)
    return {'events':[event(1,5.1,-12,-77),event(2,4.1,-12,-77),event(3,5.3,-3,-73)],'total':3,'skipped':0,'cache_hit':False}

def test_rule_permissions_and_validation(setup_api):
    c,_=setup_api
    rule={'name':'Lima','min_magnitude':4.5,'cooldown_minutes':0}
    assert c.get('/api/v1/alert-rules').status_code==401
    assert c.post('/api/v1/alert-rules',headers=login(c,'CONSULTA'),json=rule).status_code==403
    admin=login(c,'ADMINISTRADOR')
    assert c.post('/api/v1/alert-rules',headers=admin,json={**rule,'min_lat':-15}).status_code==422
    assert c.post('/api/v1/alert-rules',headers=admin,json={**rule,'cooldown_minutes':-1}).status_code==422
    r=c.post('/api/v1/alert-rules',headers=admin,json=rule)
    assert r.status_code==201,r.text
    assert r.json()['enabled'] is False
    assert c.post('/api/v1/alert-rules',headers=admin,json=rule).status_code==409
    assert len(c.get('/api/v1/alert-rules',headers=admin).json())==1

def test_rule_selects_geographic_magnitudes_and_no_push(setup_api,monkeypatch):
    c,S=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    monkeypatch.setattr(settings,'push_enabled',True)
    monkeypatch.setattr(monitoring,'get_page',sample_page)
    import app.alerts as alerts
    monkeypatch.setattr(alerts,'send_informational_push',lambda *args:(_ for _ in ()).throw(AssertionError('Push forbidden')))
    admin=login(c,'ADMINISTRADOR')
    rule={'name':'Lima high','min_magnitude':5.0,'cooldown_minutes':0,'enabled':True,'min_lat':-14,'max_lat':-10,'min_lon':-79,'max_lon':-75}
    r=c.post('/api/v1/alert-rules',headers=admin,json=rule)
    assert r.status_code==201,r.text
    scan=c.post('/api/v1/monitoring/scan',headers=admin)
    assert scan.status_code==200,scan.text
    assert scan.json()['created']==1 and scan.json()['ignored_by_rules']==2 and scan.json()['push_sent'] is False
    with S() as db:
        rows=db.scalars(select(Alert)).all()
        assert len(rows)==1 and rows[0].rule_id==r.json()['id'] and rows[0].status=='pending'

def test_cooldown_prevents_followup_candidate(setup_api,monkeypatch):
    c,S=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    monkeypatch.setattr(monitoring,'get_page',sample_page)
    admin=login(c,'ADMINISTRADOR')
    r=c.post('/api/v1/alert-rules',headers=admin,json={'name':'Global high','min_magnitude':5.0,'cooldown_minutes':120,'enabled':True})
    assert r.status_code==201
    res=c.post('/api/v1/monitoring/scan',headers=admin)
    assert res.status_code==200,res.text
    assert res.json()['created']==1 and res.json()['ignored_by_rules']==2
    with S() as db:
        assert len(db.scalars(select(Alert)).all())==1

def test_disabled_rules_do_not_create_candidates(setup_api,monkeypatch):
    c,_=setup_api
    monkeypatch.setattr(settings,'monitoring_enabled',True)
    monkeypatch.setattr(monitoring,'get_page',sample_page)
    admin=login(c,'ADMINISTRADOR')
    c.post('/api/v1/alert-rules',headers=admin,json={'name':'disabled','min_magnitude':5.0,'enabled':False})
    result=c.post('/api/v1/monitoring/scan',headers=admin)
    assert result.status_code==200,result.text
    assert result.json()['created']==0 and result.json()['ignored_by_rules']==3
