"""USGS consultation provenance and immutable event snapshots (Entrega A)."""
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def now_utc():
    return datetime.now(timezone.utc)

class QuerySnapshot(Base):
    __tablename__ = "usgs_query_snapshots"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="USGS")
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)
    queried_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    query_params: Mapped[dict] = mapped_column(JSON, nullable=False)
    result_hash: Mapped[str | None] = mapped_column(String(64))
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error_summary: Mapped[str | None] = mapped_column(String(250))
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))

class EventSnapshot(Base):
    __tablename__ = "usgs_event_snapshots"
    __table_args__ = (UniqueConstraint("query_id", "external_id", name="uq_usgs_snapshot_query_event"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    query_id: Mapped[str] = mapped_column(String(36), ForeignKey("usgs_query_snapshots.id"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(200), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    magnitude: Mapped[float | None] = mapped_column(Float)
    depth_km: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
