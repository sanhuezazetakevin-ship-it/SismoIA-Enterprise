"""Persist only monitoring decisions and provenance, not bulk USGS events."""
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base
from app.auth_models import uuid_str

def utcnow(): return datetime.now(timezone.utc)

class MonitorCandidate(Base):
    __tablename__='monitor_candidates'
    event_key:Mapped[str]=mapped_column(String(200),primary_key=True)
    alert_id:Mapped[str]=mapped_column(String(36),ForeignKey('alerts.id'),nullable=False,unique=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,nullable=False)

class MonitorRun(Base):
    __tablename__='monitor_runs'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uuid_str)
    started_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,nullable=False)
    finished_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    actor_id:Mapped[str]=mapped_column(String(36),ForeignKey('users.id'),nullable=False)
    status:Mapped[str]=mapped_column(String(24),nullable=False)
    minimum_magnitude:Mapped[float]=mapped_column(Float,nullable=False)
    days:Mapped[int]=mapped_column(Integer,nullable=False)
    examined:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    created:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    duplicates:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    reason:Mapped[str|None]=mapped_column(String(250))
