"""Audit of synchronous report exports (no exported files retained)."""
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class ReportExport(Base):
    __tablename__ = 'report_exports'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    actor_id: Mapped[str] = mapped_column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(24), nullable=False)
    format: Mapped[str] = mapped_column(String(4), nullable=False)
    filters: Mapped[dict] = mapped_column(JSON, nullable=False)
    rows_count: Mapped[int] = mapped_column(Integer, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
