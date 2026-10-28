from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.config import settings
from app.auth_models import User, Role, Permission, UserRole, RolePermission, AuthSession, AuditLog
from app.security import verify_password, hash_password, issue_access, decode_access, new_refresh, token_hash
import jwt

router=APIRouter(prefix='/api/v1', tags=['Identity'])
bearer=HTTPBearer(auto_error=False)

def db_session():
    with SessionLocal() as db: yield db

def now(): return datetime.now(timezone.utc)
def aware(dt): return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

def audit(db, action, actor, result, target=None):
    db.add(AuditLog(action=action,actor_id=actor,result=result,target_id=target))

def permissions(db, user):
    stmt=(select(Permission.code).join(RolePermission,Permission.id==RolePermission.permission_id)
          .join(UserRole,UserRole.role_id==RolePermission.role_id).where(UserRole.user_id==user.id))
    return set(db.scalars(stmt).all())

def public_user(db,user):
    roles=db.scalars(select(Role.code).join(UserRole,UserRole.role_id==Role.id).where(UserRole.user_id==user.id)).all()
    return {'id':user.id,'email':user.email,'full_name':user.full_name,'is_active':user.is_active,'roles':sorted(roles),'permissions':sorted(permissions(db,user))}

def current_user(credentials:HTTPAuthorizationCredentials|None=Depends(bearer),db:Session=Depends(db_session)):
    if not credentials: raise HTTPException(401,'No autenticado',headers={'WWW-Authenticate':'Bearer'})
    try: claims=decode_access(credentials.credentials)
    except jwt.PyJWTError: raise HTTPException(401,'Token inválido')
    user=db.get(User, claims['sub']); session=db.get(AuthSession,claims['sid'])
    if not user or not user.is_active or not session or session.user_id!=user.id or session.revoked_at or aware(session.expires_at)<=now():
        raise HTTPException(401,'Sesión inválida')
    return user

def require(permission):
    def gate(user:User=Depends(current_user),db:Session=Depends(db_session)):
        if permission not in permissions(db,user):raise HTTPException(403,'Permiso insuficiente')
        return user
    return gate

class LoginIn(BaseModel):
    email: str
    password: str

class NewUser(BaseModel):
    email: EmailStr
    full_name: str=Field(min_length=2,max_length=150)
    password: str=Field(min_length=12,max_length=128)
    role: str

class ChangeStatus(BaseModel):
    is_active: bool

class SetRole(BaseModel):
    role: str

COOKIE='sismoia_refresh'

def cookie(response,refresh):
    samesite = settings.refresh_cookie_samesite
    if settings.refresh_cookie_secure and samesite == 'lax':
        samesite = 'none'
    response.set_cookie(COOKIE,refresh,httponly=True,secure=settings.refresh_cookie_secure,samesite=samesite,path='/api/v1/auth',max_age=7*86400)

def clear_cookie(response):
    samesite = settings.refresh_cookie_samesite
    if settings.refresh_cookie_secure and samesite == 'lax':
        samesite = 'none'
    response.delete_cookie(COOKIE,path='/api/v1/auth',secure=settings.refresh_cookie_secure,samesite=samesite)

def refresh_session(db,user,response):
    secret=new_refresh()
    session=AuthSession(user_id=user.id,refresh_hash=token_hash(secret),expires_at=now()+timedelta(days=7))
    db.add(session);db.flush();cookie(response,secret)
    result={'access_token':issue_access(user.id,session.id),'token_type':'bearer','user':public_user(db,user)}
    return result

@router.post('/auth/login')
def login(data:LoginIn,response:Response,db:Session=Depends(db_session)):
    user=db.scalar(select(User).where(User.email==data.email.strip().lower()))
    if not user or not user.is_active or not verify_password(data.password,user.password_hash):
        audit(db,'auth.login',None,'denied');db.commit()
        raise HTTPException(401,'Credenciales inválidas')
    result=refresh_session(db,user,response)
    audit(db,'auth.login',user.id,'success');db.commit()
    return result

@router.post('/auth/refresh')
def refresh(request:Request,response:Response,db:Session=Depends(db_session)):
    raw=request.cookies.get(COOKIE)
    session=db.scalar(select(AuthSession).where(AuthSession.refresh_hash==token_hash(raw))) if raw else None
    if not session or session.revoked_at or aware(session.expires_at)<=now():
        clear_cookie(response);raise HTTPException(401,'Refresh inválido')
    user=db.get(User,session.user_id)
    if not user or not user.is_active:raise HTTPException(401,'Usuario inactivo')
    session.revoked_at=now()
    result=refresh_session(db,user,response)
    audit(db,'auth.refresh',user.id,'success');db.commit()
    return result

@router.post('/auth/logout')
def logout(request:Request,response:Response,db:Session=Depends(db_session)):
    raw=request.cookies.get(COOKIE)
    session=db.scalar(select(AuthSession).where(AuthSession.refresh_hash==token_hash(raw))) if raw else None
    if session and not session.revoked_at:
        session.revoked_at=now();audit(db,'auth.logout',session.user_id,'success');db.commit()
    clear_cookie(response)
    return {'ok':True}

@router.get('/auth/me')
def me(user:User=Depends(current_user),db:Session=Depends(db_session)):
    return public_user(db,user)

@router.get('/users')
def users(user:User=Depends(require('usuarios.ver')),db:Session=Depends(db_session)):
    return [public_user(db,u) for u in db.scalars(select(User).order_by(User.created_at)).all()]

@router.post('/users',status_code=201)
def create_user(data:NewUser,user:User=Depends(require('usuarios.crear')),db:Session=Depends(db_session)):
    role=db.scalar(select(Role).where(Role.code==data.role))
    if not role:raise HTTPException(422,'Rol desconocido')
    email=data.email.strip().lower()
    if db.scalar(select(User).where(User.email==email)):raise HTTPException(409,'Correo en uso')
    obj=User(email=email,full_name=data.full_name,password_hash=hash_password(data.password))
    db.add(obj);db.flush();db.add(UserRole(user_id=obj.id,role_id=role.id));audit(db,'users.create',user.id,'success',obj.id);db.commit()
    return public_user(db,obj)

@router.patch('/users/{user_id}/status')
def status(user_id:str,data:ChangeStatus,user:User=Depends(require('usuarios.editar')),db:Session=Depends(db_session)):
    target=db.get(User,user_id)
    if not target:raise HTTPException(404,'Usuario no encontrado')
    if target.id==user.id and not data.is_active:raise HTTPException(409,'No puedes desactivar tu propia cuenta')
    target.is_active=data.is_active
    if not data.is_active:
        for session in db.scalars(select(AuthSession).where(AuthSession.user_id==target.id,AuthSession.revoked_at.is_(None))):session.revoked_at=now()
    audit(db,'users.status',user.id,'success',target.id);db.commit()
    return public_user(db,target)

@router.put('/users/{user_id}/role')
def set_role(user_id:str,data:SetRole,user:User=Depends(require('roles.asignar')),db:Session=Depends(db_session)):
    target=db.get(User,user_id);role=db.scalar(select(Role).where(Role.code==data.role))
    if not target:raise HTTPException(404,'Usuario no encontrado')
    if not role:raise HTTPException(422,'Rol desconocido')
    if target.id==user.id:raise HTTPException(409,'No puedes modificar tu propio rol')
    for link in db.scalars(select(UserRole).where(UserRole.user_id==user_id)).all():db.delete(link)
    db.flush();db.add(UserRole(user_id=user_id,role_id=role.id));audit(db,'roles.assign',user.id,'success',target.id);db.commit()
    return public_user(db,target)

@router.get('/audit-logs')
def logs(limit:int=50,user:User=Depends(require('auditoria.ver')),db:Session=Depends(db_session)):
    limit=max(1,min(limit,100))
    logs=db.scalars(select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(limit)).all()
    return [{'id':x.id,'actor_id':x.actor_id,'action':x.action,'target_id':x.target_id,'result':x.result,'occurred_at':x.occurred_at} for x in logs]
