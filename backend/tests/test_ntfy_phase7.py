"""Sin envío real a ntfy ni conexión a Internet."""
import pytest
import httpx
from app.config import settings
from app.push_gateway import send_informational_push,validate_ntfy_configuration
from tests.test_security_automated import setup_api, login

def test_disabled_ntfy_never_calls_http(monkeypatch):
    monkeypatch.setattr(settings,'push_enabled',False)
    def forbidden(*a,**kw):raise AssertionError('no HTTP')
    monkeypatch.setattr(httpx.Client,'post',forbidden)
    with pytest.raises(RuntimeError):send_informational_push('anytopic01','Test','No se debe enviar')

def test_config_validation(monkeypatch):
    monkeypatch.setattr(settings,'push_enabled',True)
    monkeypatch.setattr(settings,'ntfy_topic','sismoia_test_topic')
    monkeypatch.setattr(settings,'ntfy_base_url','http://ntfy.sh')
    with pytest.raises(RuntimeError):validate_ntfy_configuration()
    monkeypatch.setattr(settings,'ntfy_base_url','https://ntfy.sh')
    validate_ntfy_configuration()
    with pytest.raises(ValueError):send_informational_push('otro_canal','test','text')

def test_send_once_to_configured_topic(monkeypatch):
    monkeypatch.setattr(settings,'push_enabled',True)
    monkeypatch.setattr(settings,'ntfy_topic','sismoia_test_topic')
    monkeypatch.setattr(settings,'ntfy_base_url','https://ntfy.sh')
    monkeypatch.setattr(settings,'ntfy_priority',4)
    monkeypatch.setattr(settings,'ntfy_access_token','')
    calls=[]
    def fake_post(self,url,**kwargs):
        calls.append((url,kwargs))
        return httpx.Response(200,json={'id':'msg-1'},request=httpx.Request('POST',url))
    monkeypatch.setattr(httpx.Client,'post',fake_post)
    assert send_informational_push('sismoia_test_topic','Aviso validado','Evento registrado')=='msg-1'
    assert len(calls)==1 and calls[0][1]['headers']['Priority']=='4'
    assert calls[0][1]['headers']['Cache']=='no'

def test_send_rejected_if_not_approved(setup_api,monkeypatch):
    c,_=setup_api
    admin=login(c,'ADMINISTRADOR')
    monkeypatch.setattr(settings,'push_enabled',True)
    monkeypatch.setattr(settings,'ntfy_topic','sismoia_test_topic')
    monkeypatch.setattr(settings,'ntfy_base_url','https://ntfy.sh')
    import app.alerts as module
    monkeypatch.setattr(module,'send_informational_push',lambda *a: (_ for _ in ()).throw(AssertionError('unexpected')))
    draft=c.post('/api/v1/alerts',headers=admin,json={'external_event_id':'usgs-demo','title':'Aviso informativo registrado','body':'Observación sísmica sujeta a revisión humana.'}).json()
    assert c.post(f"/api/v1/alerts/{draft['id']}/send",headers=admin,json={"note":"Intento sin aprobación"}).status_code==409
