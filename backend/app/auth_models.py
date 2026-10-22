import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def uuid_str(): return str(uuid.uuid4())
def utc_now(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__='users'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uuid_str)
    email: Mapped[str] = mapped_column(String(254),unique=True,index=True,nullable=False)
    full_name: Mapped[str] = mapped_column(String(150),nullable=False)
    password_hash: Mapped[str] = mapped_column(Text,nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean,default=True,nullable=False)
    token_version: Mapped[int] = mapped_column(Integer,default=0,nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=utc_now,nullable=False)

class Role(Base):
    __tablename__='roles'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uuid_str)
    code: Mapped[str] = mapped_column(String(40),unique=True,nullable=False)
    description: Mapped[str] = mapped_column(String(150),nullable=False)

class Permission(Base):
    __tablename__='permissions'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uuid_str)
    code: Mapped[str] = mapped_column(String(100),unique=True,nullable=False)

class UserRole(Base):
    __tablename__='user_roles'
    __table_args__=(UniqueConstraint('user_id','role_id'),)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'),primary_key=True)
    role_id: Mapped[str] = mapped_column(ForeignKey('roles.id',ondelete='CASCADE'),primary_key=True)

class RolePermission(Base):
    __tablename__='role_permissions'
    role_id: Mapped[str] = mapped_column(ForeignKey('roles.id',ondelete='CASCADE'),primary_key=True)
    permission_id: Mapped[str] = mapped_column(ForeignKey('permissions.id',ondelete='CASCADE'),primary_key=True)

class AuthSession(Base):
    __tablename__='auth_sessions'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uuid_str)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64),unique=True,nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=utc_now,nullable=False)

class AuditLog(Base):
    __tablename__='audit_logs'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uuid_str)
    actor_id: Mapped[str | None] = mapped_column(String(36),nullable=True,index=True)
    action: Mapped[str] = mapped_column(String(80),nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(36))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=utc_now,nullable=False)
    result: Mapped[str] = mapped_column(String(30),nullable=False)
