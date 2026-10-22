import uuid
from sqlalchemy import JSON, Integer
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Float, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

class DataSource(Base):
    __tablename__ = "data_sources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), unique=True)
    base_url: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(30), default="disabled")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True),nullable=True)

class SeismicEvent(Base):
    __tablename__ = "seismic_events"
    __table_args__ = (UniqueConstraint("source_id", "external_id"), CheckConstraint("latitude BETWEEN -90 AND 90"), CheckConstraint("longitude BETWEEN -180 AND 180"), CheckConstraint("depth_km IS NULL OR depth_km >= 0"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id"))
    external_id: Mapped[str] = mapped_column(String(200))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    magnitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    place: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True),nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON,nullable=True)

class IngestionRun(Base):
    __tablename__ = "ingestion_runs"
    id: Mapped[str] = mapped_column(String(36),primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id"),nullable=False,index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24),nullable=False)
    records_seen: Mapped[int] = mapped_column(Integer,default=0)
    records_inserted: Mapped[int] = mapped_column(Integer,default=0)
    records_updated: Mapped[int] = mapped_column(Integer,default=0)
    records_skipped: Mapped[int] = mapped_column(Integer,default=0)
    error_summary: Mapped[str | None] = mapped_column(String(300))
