"""Minimal configured rules: review candidates only, no automatic delivery."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from app.snapshot_models import QuerySnapshot, EventSnapshot
from sqlalchemy.orm import Session
from app.auth import db_session, require, audit
from app.auth_models import User
from app.alert_models import AlertRule

router=APIRouter(prefix='/api/v1/alert-rules',tags=['Reviewed alert rules'])

class RuleIn(BaseModel):
    name:str=Field(min_length=3,max_length=100)
    min_magnitude:float=Field(ge=3.5,le=9.9)
    min_lat:float|None=Field(default=None,ge=-90,le=90)
    max_lat:float|None=Field(default=None,ge=-90,le=90)
    min_lon:float|None=Field(default=None,ge=-180,le=180)
    max_lon:float|None=Field(default=None,ge=-180,le=180)
    cooldown_minutes:int=Field(default=0,ge=0,le=10080)
    enabled:bool=False

    @model_validator(mode='after')
    def bounds(self):
        fields=(self.min_lat,self.max_lat,self.min_lon,self.max_lon)
        if any(x is not None for x in fields):
            if not all(x is not None for x in fields):
                raise ValueError('Proporcione las cuatro coordenadas de la zona')
            if self.min_lat >= self.max_lat or self.min_lon >= self.max_lon:
                raise ValueError('La caja geográfica tiene límites inválidos')
        return self

def serialize(r):
    return {k:getattr(r,k) for k in ('id','name','min_magnitude','min_lat','max_lat','min_lon','max_lon','cooldown_minutes','enabled','created_at')}

@router.get('')
def list_rules(actor:User=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    return [serialize(r) for r in db.scalars(select(AlertRule).order_by(AlertRule.created_at)).all()]

@router.post('',status_code=201)
def create_rule(data:RuleIn,actor:User=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    if db.scalar(select(AlertRule.id).where(AlertRule.name==data.name)):
        raise HTTPException(409,'Ya existe una regla con ese nombre')
    r=AlertRule(**data.model_dump(),created_by=actor.id)
    db.add(r);db.flush();audit(db,'alert_rules.create',actor.id,'success',r.id);db.commit()
    return serialize(r)

@router.put('/{rule_id}')
def update_rule(rule_id:str,data:RuleIn,actor:User=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    r=db.get(AlertRule,rule_id)
    if r is None: raise HTTPException(404,'Regla no encontrada')
    if db.scalar(select(AlertRule.id).where(AlertRule.name==data.name,AlertRule.id!=rule_id)):
        raise HTTPException(409,'Ya existe una regla con ese nombre')
    for k,v in data.model_dump().items(): setattr(r,k,v)
    audit(db,'alert_rules.update',actor.id,'success',r.id);db.commit()
    return serialize(r)

def eligible(rule,event):
    if event.magnitude < rule.min_magnitude: return False
    if rule.min_lat is not None:
        lat=getattr(event,'latitude',None)
        lon=getattr(event,'longitude',None)
        if lat is None or lon is None: return False
        if not (rule.min_lat<=lat<=rule.max_lat and rule.min_lon<=lon<=rule.max_lon):return False
    return True


@router.get('/{rule_id}/simulate')
def simulate(rule_id:str,snapshot_id:str,actor:User=Depends(require('alertas.configurar')),db:Session=Depends(db_session)):
    """Retrospective dry run. Does not create alerts, reviews, candidates or deliveries."""
    r=db.get(AlertRule,rule_id)
    if r is None: raise HTTPException(404,'Regla no encontrada')
    snap=db.get(QuerySnapshot,snapshot_id)
    if snap is None or snap.status!='completed': raise HTTPException(404,'Snapshot completo no encontrado')
    rows=db.scalars(select(EventSnapshot).where(EventSnapshot.query_id==snapshot_id).order_by(EventSnapshot.occurred_at,EventSnapshot.external_id)).all()
    matched=[];ignored=0;last=None
    from datetime import timedelta, timezone
    for e in rows:
        if e.magnitude is None or not eligible(r,e):continue
        t=e.occurred_at
        if t.tzinfo is None:t=t.replace(tzinfo=timezone.utc)
        if last is not None and t-last<timedelta(minutes=r.cooldown_minutes):ignored+=1;continue
        matched.append({'external_id':e.external_id,'magnitude':e.magnitude,'occurred_at':e.occurred_at,'latitude':e.latitude,'longitude':e.longitude})
        last=t
    return {'simulation':True,'messages_sent':0,'candidates_created':0,'rule_id':r.id,
        'snapshot_id':snap.id,'total_events':len(rows),'eligible':len(matched),
        'cooldown_excluded':ignored,'sample':matched[:30],
        'note':'Simulación histórica orientativa; no modifica estados ni envía avisos.'}
