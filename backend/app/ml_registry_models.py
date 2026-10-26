"""Immutable dataset manifests and retrospective ML study results."""
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def now_utc():
    return datetime.now(timezone.utc)

class DatasetVersion(Base):
    __tablename__ = 'ml_dataset_versions'
    __table_args__ = (UniqueConstraint('snapshot_id','content_sha256',name='uq_ml_dataset_snapshot_hash'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda:str(uuid4()))
    snapshot_id: Mapped[str] = mapped_column(String(36),ForeignKey('usgs_query_snapshots.id'),nullable=False,index=True)
    content_sha256: Mapped[str] = mapped_column(String(64),nullable=False)
    row_count: Mapped[int] = mapped_column(Integer,nullable=False)
    quality_report: Mapped[dict] = mapped_column(JSON,nullable=False)
    manifest: Mapped[dict] = mapped_column(JSON,nullable=False)
    created_by: Mapped[str] = mapped_column(String(36),ForeignKey('users.id'),nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now_utc,nullable=False)

class MLStudy(Base):
    __tablename__ = 'ml_studies'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
    dataset_id: Mapped[str] = mapped_column(String(36),ForeignKey('ml_dataset_versions.id'),nullable=False,index=True)
    kind: Mapped[str] = mapped_column(String(25),nullable=False)
    algorithm: Mapped[str] = mapped_column(String(80),nullable=False)
    config: Mapped[dict] = mapped_column(JSON,nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON,nullable=False)
    results: Mapped[dict] = mapped_column(JSON,nullable=False)
    limitations: Mapped[dict] = mapped_column(JSON,nullable=False)
    created_by: Mapped[str] = mapped_column(String(36),ForeignKey('users.id'),nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now_utc,nullable=False)
