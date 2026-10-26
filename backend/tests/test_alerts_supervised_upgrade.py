"""Supervised notices: evidence, required decisions and read-only historical rule simulations."""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from tests.test_security_automated import setup_api,login
from app.alert_models import Alert, AlertReview
from app.snapshot_models import QuerySnapshot,EventSnapshot
from app.alert_rules import eligible


def test_review_reason_required_and_evidence_endpoint(setup_api):
    c,S=setup_api
    admin=login(c,'ADMINISTRADOR');operator=login(c,'OPERADOR_ALERTAS')
    a=c.post('/api/v1/alerts',headers=admin,json={
        'external_event_id':'snapshot-example','title':'Observación sísmica verificada',
        'body':'Evento observado de referencia; solo comunicación interna.'}).json()
    assert c.post(f"/api/v1/alerts/{a['id']}/approve",headers=operator,json={'note':'abc'}).status_code==422
    evidence=c.get(f"/api/v1/alerts/{a['id']}/evidence",headers=operator)
    assert evidence.status_code==200 and evidence.json()['evidence_available'] is False
    response=c.post(f"/api/v1/alerts/{a['id']}/approve",headers=operator,json={'note':'Verificado manualmente en la fuente'})
    assert response.status_code==200
    details=c.get(f"/api/v1/alerts/{a['id']}/evidence",headers=operator).json()
    assert details['reviews'][0]['note']=='Verificado manualmente en la fuente'
    assert c.get(f"/api/v1/alerts/{a['id']}/evidence",headers=login(c,'CONSULTA')).status_code==403


def test_rule_simulation_is_read_only(setup_api):
    c,S=setup_api
    h=login(c,'ADMINISTRADOR')
    rule=c.post('/api/v1/alert-rules',headers=h,json={'name':'Simulación sin envíos','min_magnitude':4.0,'cooldown_minutes':60,'enabled':False}).json()
    with S() as db:
        now=datetime(2026,9,10,tzinfo=timezone.utc)
        snap=QuerySnapshot(purpose='manual',period_start=now-timedelta(days=1),period_end=now,status='completed',event_count=3,query_params={'peru_only':True})
        db.add(snap);db.flush();sid=snap.id
        for idx,magnitude in enumerate((4.5,5.0,3.0)):
            db.add(EventSnapshot(query_id=sid,external_id=f'test-sim-{idx}',occurred_at=now+timedelta(minutes=idx*10),magnitude=magnitude,depth_km=20,latitude=-12,longitude=-77,source_url='https://earthquake.usgs.gov/',event_hash=f'{idx:064d}',data={'external_id':f'test-sim-{idx}'}))
        db.commit()
    result=c.get(f"/api/v1/alert-rules/{rule['id']}/simulate?snapshot_id={sid}",headers=h)
    assert result.status_code==200,result.text
    data=result.json()
    assert data['total_events']==3 and data['eligible']==1 and data['cooldown_excluded']==1
    assert data['messages_sent']==0 and data['candidates_created']==0
    with S() as db:
        assert db.scalar(select(func.count()).select_from(Alert))==0
        assert db.scalar(select(func.count()).select_from(AlertReview))==0
    assert c.get(f"/api/v1/alert-rules/{rule['id']}/simulate?snapshot_id={sid}",headers=login(c,'CONSULTA')).status_code==403
