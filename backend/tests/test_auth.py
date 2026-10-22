import os
os.environ.setdefault('DATABASE_URL','sqlite+pysqlite:///:memory:')
os.environ['JWT_SECRET']='test-only-fixed-secret-not-for-production-0123456789'
from fastapi.testclient import TestClient
from sqlalchemy import create_engine,select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base
from app.main import app
from app.auth import db_session
from app.auth_models import User,Role,Permission,RolePermission,UserRole
from app.security import hash_password
from app.config import settings

settings.jwt_secret=os.environ['JWT_SECRET']
engine=create_engine('sqlite+pysqlite:///:memory:',connect_args={'check_same_thread':False},poolclass=StaticPool)
Session=sessionmaker(bind=engine)
Base.metadata.create_all(engine)

def test_identity_lifecycle():
    with Session() as db:
        r=Role(code='ADMINISTRADOR',description='Administrador');p=Permission(code='usuarios.crear')
        db.add_all([r,p]);db.flush();db.add(RolePermission(role_id=r.id,permission_id=p.id))
        admin=User(email='admin@example.com',full_name='Administrador',password_hash=hash_password('secure-password-1234'))
        db.add(admin);db.flush();db.add(UserRole(user_id=admin.id,role_id=r.id));db.commit()
    def override_db():
        with Session() as db: yield db
    app.dependency_overrides[db_session]=override_db
    try:
        with TestClient(app) as client:
            assert client.post('/api/v1/auth/login',json={'email':'admin@example.com','password':'bad-password'}).status_code==401
            response=client.post('/api/v1/auth/login',json={'email':'admin@example.com','password':'secure-password-1234'})
            assert response.status_code==200
            token=response.json()['access_token']
            assert client.get('/api/v1/auth/me').status_code==401
            auth={'Authorization':f'Bearer {token}'}
            assert client.get('/api/v1/auth/me',headers=auth).json()['email']=='admin@example.com'
            assert client.get('/api/v1/audit-logs',headers=auth).status_code==403
            created=client.post('/api/v1/users',headers=auth,json={'email':'reader@example.com','full_name':'Reader Person','password':'reader-password-1234','role':'ADMINISTRADOR'})
            assert created.status_code==201
            refresh=client.post('/api/v1/auth/refresh')
            assert refresh.status_code==200
            rotated=client.post('/api/v1/auth/refresh')
            assert rotated.status_code==200
            assert client.post('/api/v1/auth/logout').status_code==200
            assert client.post('/api/v1/auth/refresh').status_code==401
    finally:
        app.dependency_overrides.clear()
