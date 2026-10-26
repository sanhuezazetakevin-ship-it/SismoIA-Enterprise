"""Regression: authorization, approval separation, push closed by default."""
from tests.test_security_automated import setup_api, login
from app.alert_models import Alert, AlertReview, PushDevice
from sqlalchemy import select

def payload():
    return {'external_event_id':'usgs-example-2026','title':'Evento sísmico observado','body':'Reporte informativo revisable procedente de USGS, no alerta temprana.'}

def test_private_alerts(setup_api):
    c,_=setup_api
    assert c.get('/api/v1/alerts').status_code==401
    assert c.post('/api/v1/alerts',json=payload()).status_code==401
    h=login(c,'CONSULTA')
    assert c.post('/api/v1/alerts',headers=h,json=payload()).status_code==403
    assert c.get('/api/v1/alerts',headers=h).status_code==403

def test_create_list_approve_other_operator(setup_api):
    c,S=setup_api
    admin=login(c,'ADMINISTRADOR');operator=login(c,'OPERADOR_ALERTAS')
    r=c.post('/api/v1/alerts',headers=admin,json=payload());assert r.status_code==201,r.text
    ident=r.json()['id']
    assert c.post(f'/api/v1/alerts/{ident}/approve',headers=admin,json={'note':'Revisión correcta de evento'}).status_code==409
    approved=c.post(f'/api/v1/alerts/{ident}/approve',headers=operator,json={'note':'Fuente contrastada con USGS'})
    assert approved.status_code==200,approved.text
    assert approved.json()['status']=='approved'
    assert c.post(f'/api/v1/alerts/{ident}/approve',headers=operator,json={'note':'Duplicado no permitido'}).status_code==409
    assert c.post(f'/api/v1/alerts/{ident}/send',headers=operator,json={'note':'Confirmación explícita de envío'}).status_code==503
    with S() as db:
        assert len(db.scalars(select(AlertReview).where(AlertReview.alert_id==ident)).all())==1

def test_rejected_cannot_be_approved(setup_api):
    c,_=setup_api
    admin=login(c,'ADMINISTRADOR');operator=login(c,'OPERADOR_ALERTAS')
    ident=c.post('/api/v1/alerts',headers=admin,json=payload()).json()['id']
    assert c.post(f'/api/v1/alerts/{ident}/reject',headers=operator,json={'note':'no verificable'}).status_code==200
    assert c.post(f'/api/v1/alerts/{ident}/approve',headers=operator,json={'note':'Intento posterior inválido'}).status_code==409

def test_only_approver_can_register_configured_topic(setup_api,monkeypatch):
    c,_=setup_api
    admin=login(c,'ADMINISTRADOR');reader=login(c,'CONSULTA')
    from app.config import settings
    monkeypatch.setattr(settings,'ntfy_topic','sismoia_private_topic_test')
    data={'token':'sismoia_private_topic_test','platform':'ntfy'}
    assert c.post('/api/v1/alerts/devices',headers=reader,json=data).status_code==403
    assert c.post('/api/v1/alerts/devices',headers=admin,json={**data,'token':'wrong_topic'}).status_code==422
    r=c.post('/api/v1/alerts/devices',headers=admin,json=data)
    assert r.status_code==201,r.text
    id=r.json()['id']
    assert c.delete(f'/api/v1/alerts/devices/{id}',headers=reader).status_code==404
    assert c.delete(f'/api/v1/alerts/devices/{id}',headers=admin).status_code==200

def test_disabled_provider_does_not_send(setup_api,monkeypatch):
    c,_=setup_api
    h=login(c,'ADMINISTRADOR')
    import app.alerts as alerts
    def forbidden(*args,**kwargs):raise AssertionError('provider must not be called')
    monkeypatch.setattr(alerts,'send_informational_push',forbidden)
    assert c.post('/api/v1/alerts/nonexistent/send',headers=h,json={'note':'Comprobación con envío apagado'}).status_code==503
    assert c.get('/api/v1/alerts/delivery/config',headers=h).json()['enabled'] is False
