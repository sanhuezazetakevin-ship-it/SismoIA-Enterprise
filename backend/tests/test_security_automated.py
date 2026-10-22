"""Pruebas focalizadas Fase 2. SQLite temporal; no conecta a Supabase.
Ejecutar: python -m pytest tests/test_security_automated.py -q -ra
"""
import os
os.environ['DATABASE_URL'] = 'sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET'] = 'local-test-only-secret-change-in-production-0123456789abcdef'
os.environ['REFRESH_COOKIE_SECURE'] = 'false'

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.config import settings
settings.jwt_secret = os.environ['JWT_SECRET']
settings.refresh_cookie_secure = False
from app.db import Base
from app.main import app
from app.auth import db_session
from app.auth_models import User, Role, Permission, RolePermission, UserRole, AuthSession, AuditLog
from app.security import hash_password
from scripts.bootstrap_auth import CATALOG

PASSWORD = 'Password-for-local-tests-2026!'

@pytest.fixture
def setup_api():
    engine = create_engine('sqlite+pysqlite:///:memory:', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    with Session() as db:
        role_map = {}
        perms = {}
        for code in sorted({p for codes in CATALOG.values() for p in codes}):
            p = Permission(code=code); db.add(p); db.flush(); perms[code] = p
        for code, codes in CATALOG.items():
            role = Role(code=code,description=code); db.add(role);db.flush(); role_map[code]=role
            for perm in codes:
                db.add(RolePermission(role_id=role.id,permission_id=perms[perm].id))
        for role in CATALOG:
            user = User(email=f'{role.lower()}@example.com',full_name=f'User {role}',password_hash=hash_password(PASSWORD))
            db.add(user);db.flush();db.add(UserRole(user_id=user.id,role_id=role_map[role].id))
        db.commit()
    def override():
        with Session() as db:
            yield db
    app.dependency_overrides[db_session] = override
    with TestClient(app) as client:
        yield client, Session
    app.dependency_overrides.pop(db_session,None)
    Base.metadata.drop_all(engine)
    engine.dispose()

def login(client, role):
    response=client.post('/api/v1/auth/login',json={'email':f'{role.lower()}@example.com','password':PASSWORD})
    assert response.status_code==200, response.text
    return {'Authorization':f"Bearer {response.json()['access_token']}"}

def test_all_five_roles_have_expected_permissions(setup_api):
    client,_=setup_api
    for role, expected in CATALOG.items():
        headers=login(client,role)
        response=client.get('/api/v1/auth/me',headers=headers)
        assert response.status_code==200
        assert response.json()['roles']==[role]
        assert set(response.json()['permissions'])==set(expected)

def test_anonymous_requests_are_rejected(setup_api):
    client,_=setup_api
    for path in ('/api/v1/users','/api/v1/audit-logs','/api/v1/auth/me'):
        assert client.get(path).status_code==401

def test_invalid_password_rejected_and_audited(setup_api):
    client,Session=setup_api
    response=client.post('/api/v1/auth/login',json={'email':'consulta@example.com','password':'bad-pass'})
    assert response.status_code==401
    with Session() as db:
        assert db.scalar(select(AuditLog).where(AuditLog.action=='auth.login',AuditLog.result=='denied')) is not None

def test_consulta_gets_403_for_admin_resources(setup_api):
    client,_=setup_api
    headers=login(client,'CONSULTA')
    assert client.get('/api/v1/users',headers=headers).status_code==403
    assert client.get('/api/v1/audit-logs',headers=headers).status_code==403
    assert client.post('/api/v1/users',headers=headers,json={'email':'new@example.com','full_name':'New User','password':PASSWORD,'role':'CONSULTA'}).status_code==403

def test_analyst_operator_and_auditor_authorizations(setup_api):
    client,_=setup_api
    for role in ('ANALISTA','OPERADOR_ALERTAS'):
        headers=login(client,role)
        assert client.get('/api/v1/users',headers=headers).status_code==403
        assert client.get('/api/v1/audit-logs',headers=headers).status_code==403
    auditor=login(client,'AUDITOR')
    assert client.get('/api/v1/audit-logs',headers=auditor).status_code==200
    assert client.get('/api/v1/users',headers=auditor).status_code==403

def test_admin_user_creation_and_audit(setup_api):
    client,Session=setup_api
    headers=login(client,'ADMINISTRADOR')
    response=client.post('/api/v1/users',headers=headers,json={'email':'created@example.com','full_name':'Created Account','password':PASSWORD,'role':'CONSULTA'})
    assert response.status_code==201,response.text
    assert response.json()['roles']==['CONSULTA']
    assert 'password_hash' not in str(response.json())
    with Session() as db:
        assert db.scalar(select(AuditLog).where(AuditLog.action=='users.create',AuditLog.result=='success')) is not None
    assert client.get('/api/v1/users',headers=headers).status_code==200

def test_duplicate_user_rejected(setup_api):
    client,_=setup_api
    h=login(client,'ADMINISTRADOR')
    assert client.post('/api/v1/users',headers=h,json={'email':'consulta@example.com','full_name':'Duplicated Account','password':PASSWORD,'role':'CONSULTA'}).status_code==409

def test_refresh_rotation_invalidates_previous_refresh(setup_api):
    client,_=setup_api
    login(client,'CONSULTA')
    previous=client.cookies.get('sismoia_refresh')
    assert previous
    response=client.post('/api/v1/auth/refresh')
    assert response.status_code==200,response.text
    newer=client.cookies.get('sismoia_refresh')
    assert newer and newer!=previous
    replay=TestClient(app)
    try:
        replay.cookies.set('sismoia_refresh',previous,path='/api/v1/auth')
        assert replay.post('/api/v1/auth/refresh').status_code==401
    finally:
        replay.close()

def test_logout_invalidates_access_token_and_refresh(setup_api):
    client,Session=setup_api
    access=login(client,'CONSULTA')
    assert client.get('/api/v1/auth/me',headers=access).status_code==200
    assert client.post('/api/v1/auth/logout').status_code==200
    assert client.get('/api/v1/auth/me',headers=access).status_code==401
    assert client.post('/api/v1/auth/refresh').status_code==401
    with Session() as db:
        assert db.scalar(select(AuditLog).where(AuditLog.action=='auth.logout')) is not None

def test_admin_deactivation_revokes_target_session(setup_api):
    client,Session=setup_api
    target_token=login(client,'CONSULTA')
    admin_token=login(client,'ADMINISTRADOR')
    with Session() as db:
        uid=db.scalar(select(User.id).where(User.email=='consulta@example.com'))
    response=client.patch(f'/api/v1/users/{uid}/status',headers=admin_token,json={'is_active':False})
    assert response.status_code==200,response.text
    assert client.get('/api/v1/auth/me',headers=target_token).status_code==401
    assert client.post('/api/v1/auth/login',json={'email':'consulta@example.com','password':PASSWORD}).status_code==401

def test_nonadmin_cannot_change_user_role(setup_api):
    client,Session=setup_api
    with Session() as db:
        uid=db.scalar(select(User.id).where(User.email=='analista@example.com'))
    token=login(client,'CONSULTA')
    assert client.put(f'/api/v1/users/{uid}/role',headers=token,json={'role':'ADMINISTRADOR'}).status_code==403

def test_admin_cannot_deactivate_self_or_change_own_role(setup_api):
    client,Session=setup_api
    admin=login(client,'ADMINISTRADOR')
    with Session() as db:
        uid=db.scalar(select(User.id).where(User.email=='administrador@example.com'))
    assert client.patch(f'/api/v1/users/{uid}/status',headers=admin,json={'is_active':False}).status_code==409
    assert client.put(f'/api/v1/users/{uid}/role',headers=admin,json={'role':'CONSULTA'}).status_code==409
