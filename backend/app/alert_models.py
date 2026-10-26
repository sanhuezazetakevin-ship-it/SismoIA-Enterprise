"""Fase 7: avisos revisados, dispositivos autorizados e intentos de entrega."""
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base
from app.auth_models import uuid_str

def now(): return datetime.now(timezone.utc)

class Alert(Base):
    __tablename__ = 'alerts'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uuid_str)
    source:Mapped[str]=mapped_column(String(24),nullable=False,default='USGS')
    external_event_id:Mapped[str]=mapped_column(String(150),nullable=False)
    title:Mapped[str]=mapped_column(String(140),nullable=False)
    body:Mapped[str]=mapped_column(String(500),nullable=False)
    status:Mapped[str]=mapped_column(String(24),nullable=False,default='pending',index=True)
    created_by:Mapped[str]=mapped_column(String(36),ForeignKey('users.id'),nullable=False)
    rule_id:Mapped[str|None]=mapped_column(String(36),ForeignKey('alert_rules.id'))
    approved_by:Mapped[str|None]=mapped_column(String(36),ForeignKey('users.id'))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),nullable=False,default=now)
    approved_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    sent_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class AlertReview(Base):
    __tablename__='alert_reviews'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uuid_str)
    alert_id:Mapped[str]=mapped_column(String(36),ForeignKey('alerts.id',ondelete='CASCADE'),nullable=False,index=True)
    actor_id:Mapped[str]=mapped_column(String(36),ForeignKey('users.id'),nullable=False)
    decision:Mapped[str]=mapped_column(String(24),nullable=False)
    note:Mapped[str|None]=mapped_column(String(500))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,nullable=False)

class PushDevice(Base):
    __tablename__='push_devices'
    __table_args__=(UniqueConstraint('token_hash'),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uuid_str)
    user_id:Mapped[str]=mapped_column(String(36),ForeignKey('users.id',ondelete='CASCADE'),nullable=False,index=True)
    token_hash:Mapped[str]=mapped_column(String(64),nullable=False)
    token:Mapped[str]=mapped_column(Text,nullable=False)
    platform:Mapped[str]=mapped_column(String(20),nullable=False,default='android')
    enabled:Mapped[bool]=mapped_column(Boolean,nullable=False,default=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,nullable=False)

class PushDelivery(Base):
    __tablename__='push_deliveries'
    __table_args__=(UniqueConstraint('alert_id','device_id'),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uuid_str)
    alert_id:Mapped[str]=mapped_column(String(36),ForeignKey('alerts.id',ondelete='CASCADE'),nullable=False)
    device_id:Mapped[str]=mapped_column(String(36),ForeignKey('push_devices.id'),nullable=False)
    status:Mapped[str]=mapped_column(String(24),nullable=False)
    provider_message_id:Mapped[str|None]=mapped_column(String(255))
    error:Mapped[str|None]=mapped_column(String(300))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,nullable=False)


class AlertRule(Base):
    """Human-reviewed USGS candidate rule; bounding box is optional (Peru only)."""
    __tablename__ = 'alert_rules'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uuid_str)
    name:Mapped[str]=mapped_column(String(100),nullable=False,unique=True)
    min_magnitude:Mapped[float]=mapped_column(__import__('sqlalchemy').Float,nullable=False)
    min_lat:Mapped[float|None]=mapped_column(__import__('sqlalchemy').Float)
    max_lat:Mapped[float|None]=mapped_column(__import__('sqlalchemy').Float)
    min_lon:Mapped[float|None]=mapped_column(__import__('sqlalchemy').Float)
    max_lon:Mapped[float|None]=mapped_column(__import__('sqlalchemy').Float)
    cooldown_minutes:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    enabled:Mapped[bool]=mapped_column(Boolean,nullable=False,default=False)
    created_by:Mapped[str]=mapped_column(String(36),ForeignKey('users.id'),nullable=False)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),nullable=False,default=now)
