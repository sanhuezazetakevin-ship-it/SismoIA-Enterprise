"""Operator-reviewed informational notices, explicitly not earthquake early warnings."""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import db_session, current_user, require, audit, now
from app.auth_models import User
from app.alert_models import Alert, AlertReview, PushDevice, PushDelivery
from app.snapshot_models import EventSnapshot, QuerySnapshot
from app.config import settings
from app.push_gateway import send_informational_push, validate_ntfy_configuration

router=APIRouter(prefix='/api/v1/alerts',tags=['Reviewed informational notices'])

class DraftIn(BaseModel):
    external_event_id:str=Field(min_length=1,max_length=150)
    title:str=Field(min_length=10,max_length=140)
    body:str=Field(min_length=20,max_length=500)
    source:str=Field(default='USGS',pattern='^USGS$')

class DecisionIn(BaseModel):
    note:str=Field(min_length=10,max_length=500)

class DeviceIn(BaseModel):
    token:str=Field(min_length=8,max_length=64)
    platform:str=Field(default='ntfy',pattern='^ntfy$')

def view(a):
    return {'id':a.id,'source':a.source,'external_event_id':a.external_event_id,'title':a.title,'body':a.body,'status':a.status,'created_at':a.created_at,'approved_at':a.approved_at,'sent_at':a.sent_at,'created_by':a.created_by,'approved_by':a.approved_by,'rule_id':a.rule_id}

@router.get('')
def list_alerts(limit:int=50,user:User=Depends(current_user),db:Session=Depends(db_session)):
    from app.auth import permissions
    if not ({'alertas.configurar','alertas.aprobar','auditoria.ver'} & permissions(db,user)):
        raise HTTPException(403,'Permiso insuficiente')
    return [view(a) for a in db.scalars(select(Alert).order_by(Alert.created_at.desc()).limit(max(1,min(limit,100)))).all()]

@router.post('',status_code=201)
def create_draft(data:DraftIn,user:User=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    a=Alert(external_event_id=data.external_event_id,source=data.source,title=data.title,body=data.body,status='pending',created_by=user.id)
    db.add(a);db.flush();audit(db,'alerts.create',user.id,'success',a.id);db.commit();return view(a)

def transition(db:Session,id:str,user:User,expected:str,target:str,note:str):
    a=db.scalar(select(Alert).where(Alert.id==id).with_for_update())
    if not a:raise HTTPException(404,'Aviso no encontrado')
    if a.status!=expected:raise HTTPException(409,f'Estado incompatible: {a.status}')
    if expected=='pending' and target=='approved' and a.created_by==user.id:
        raise HTTPException(409,'La aprobación requiere otro operador autorizado')
    if len(note.strip()) < 10: raise HTTPException(422,'Explique la decisión (mínimo 10 caracteres)')
    a.status=target
    if target=='approved':a.approved_by=user.id;a.approved_at=now()
    db.add(AlertReview(alert_id=a.id,actor_id=user.id,decision=target,note=note))
    audit(db,'alerts.'+target,user.id,'success',a.id)
    db.commit();return view(a)

@router.post('/{id}/approve')
def approve(id:str,data:DecisionIn,user:User=Depends(require('alertas.aprobar')),db:Session=Depends(db_session)):
    return transition(db,id,user,'pending','approved',data.note)

@router.post('/{id}/reject')
def reject(id:str,data:DecisionIn,user:User=Depends(require('alertas.aprobar')),db:Session=Depends(db_session)):
    return transition(db,id,user,'pending','rejected',data.note)

@router.post('/{id}/cancel')
def cancel(id:str,data:DecisionIn,user:User=Depends(require('alertas.aprobar')),db:Session=Depends(db_session)):
    a=db.get(Alert,id)
    if not a:raise HTTPException(404,'Aviso no encontrado')
    if a.status not in ('pending','approved'):raise HTTPException(409,'El aviso ya no se puede cancelar')
    return transition(db,id,user,a.status,'cancelled',data.note)

@router.post('/devices',status_code=201)
def register_device(data:DeviceIn,user:User=Depends(require('alertas.aprobar')),db:Session=Depends(db_session)):
    if not settings.ntfy_topic or data.token != settings.ntfy_topic:
        raise HTTPException(422,'Tema ntfy no configurado o distinto del permitido')
    digest=hashlib.sha256(data.token.encode()).hexdigest()
    existing=db.scalar(select(PushDevice).where(PushDevice.token_hash==digest))
    if existing and existing.user_id!=user.id:raise HTTPException(409,'Dispositivo asociado a otro usuario')
    if existing:existing.enabled=True;obj=existing
    else:obj=PushDevice(user_id=user.id,token_hash=digest,token=data.token,platform=data.platform);db.add(obj)
    db.flush();audit(db,'push.device.register',user.id,'success',obj.id);db.commit()
    return {'id':obj.id,'platform':obj.platform,'enabled':obj.enabled}

@router.get('/devices/mine')
def my_devices(user:User=Depends(current_user),db:Session=Depends(db_session)):
    return [{'id':x.id,'platform':x.platform,'enabled':x.enabled} for x in db.scalars(select(PushDevice).where(PushDevice.user_id==user.id)).all()]

@router.delete('/devices/{id}')
def revoke_device(id:str,user:User=Depends(current_user),db:Session=Depends(db_session)):
    obj=db.get(PushDevice,id)
    if not obj or obj.user_id!=user.id:raise HTTPException(404,'Dispositivo no encontrado')
    obj.enabled=False;audit(db,'push.device.revoke',user.id,'success',obj.id);db.commit();return {'ok':True}

@router.get('/delivery/config')
def delivery_config(user:User=Depends(require('alertas.aprobar'))):
    return {'enabled':settings.push_enabled,'provider':'ntfy','topic_configured':bool(settings.ntfy_topic),'channel':'ntfy_android','disclaimer':'Avisos informativos; no son alertas sísmicas tempranas oficiales.'}

@router.get('/{id}/evidence')
def evidence(id:str,user:User=Depends(require('alertas.aprobar')),db:Session=Depends(db_session)):
    a=db.get(Alert,id)
    if not a:raise HTTPException(404,'Aviso no encontrado')
    observed=db.scalar(select(EventSnapshot).join(QuerySnapshot,EventSnapshot.query_id==QuerySnapshot.id)
        .where(EventSnapshot.external_id==a.external_event_id,QuerySnapshot.status=='completed')
        .order_by(QuerySnapshot.queried_at.desc()))
    reviews=db.scalars(select(AlertReview).where(AlertReview.alert_id==id).order_by(AlertReview.created_at)).all()
    return {'notice':view(a),'observation':({
        'external_id':observed.external_id,'magnitude':observed.magnitude,'depth_km':observed.depth_km,
        'latitude':observed.latitude,'longitude':observed.longitude,'occurred_at':observed.occurred_at,
        'source_url':observed.source_url,'snapshot_id':observed.query_id,
        'event_sha256':observed.event_hash} if observed else None),
        'evidence_available':bool(observed),'reviews':[{'decision':r.decision,'actor_id':r.actor_id,
        'note':r.note,'created_at':r.created_at} for r in reviews],
        'disclaimer':'Información observada para revisión interna; no es aviso oficial ni predicción.'}

@router.post('/{id}/send')
def send(id:str,data:DecisionIn,user:User=Depends(require('alertas.aprobar')),db:Session=Depends(db_session)):
    if not data.note.strip() or len(data.note.strip())<10: raise HTTPException(422,'Motivo obligatorio para enviar')
    if not settings.push_enabled:raise HTTPException(503,'Envío ntfy deshabilitado hasta configurar el canal y validar Android')
    try:
        validate_ntfy_configuration()
    except RuntimeError as exc:
        raise HTTPException(503,str(exc)) from exc
    a=db.scalar(select(Alert).where(Alert.id==id).with_for_update())
    if not a:raise HTTPException(404,'Aviso no encontrado')
    if a.status!='approved':raise HTTPException(409,'Requiere aprobación humana antes del envío')
    # Mark dispatched before calling external provider, preventing repeated delivery on retries.
    a.status='dispatching';db.add(AlertReview(alert_id=a.id,actor_id=user.id,decision='send_confirmed',note=data.note.strip()));audit(db,'alerts.dispatch.start',user.id,'success',a.id);db.commit()
    devices=db.scalars(select(PushDevice).where(PushDevice.enabled.is_(True),PushDevice.platform=='ntfy',PushDevice.token==settings.ntfy_topic)).all()[:1]  # Un mensaje por tema, nunca uno por teléfono
    successes=0;failures=0
    for device in devices:
        try:
            provider_id=send_informational_push(device.token,a.title,a.body)
            delivery=PushDelivery(alert_id=a.id,device_id=device.id,status='accepted',provider_message_id=provider_id)
            successes+=1
        except Exception as exc:
            delivery=PushDelivery(alert_id=a.id,device_id=device.id,status='failed',error=str(exc)[:300]);failures+=1
        db.add(delivery)
    a.status='sent' if successes else 'failed';a.sent_at=now();audit(db,'alerts.dispatch.complete',user.id,a.status,a.id);db.commit()
    return {'status':a.status,'accepted_by_ntfy':successes,'failed':failures,'note':'Aceptación del servidor ntfy no garantiza recepción, sonido o vibración en Android'}
