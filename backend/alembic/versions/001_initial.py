"""Initial seismic data schema"""
from alembic import op
import sqlalchemy as sa
revision = "001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("data_sources",sa.Column("id",sa.String(36),primary_key=True),sa.Column("name",sa.String(120),nullable=False,unique=True),sa.Column("base_url",sa.String(1000),nullable=False),sa.Column("status",sa.String(30),nullable=False))
    op.create_table("seismic_events",sa.Column("id",sa.String(36),primary_key=True),sa.Column("source_id",sa.String(36),sa.ForeignKey("data_sources.id"),nullable=False),sa.Column("external_id",sa.String(200),nullable=False),sa.Column("occurred_at",sa.DateTime(timezone=True),nullable=False),sa.Column("latitude",sa.Float,nullable=False),sa.Column("longitude",sa.Float,nullable=False),sa.Column("magnitude",sa.Float),sa.Column("depth_km",sa.Float),sa.Column("place",sa.String(255)),sa.Column("source_url",sa.String(1000)),sa.UniqueConstraint("source_id","external_id"),sa.CheckConstraint("latitude BETWEEN -90 AND 90"),sa.CheckConstraint("longitude BETWEEN -180 AND 180"),sa.CheckConstraint("depth_km IS NULL OR depth_km >= 0"))
    op.create_index("ix_seismic_events_occurred_at","seismic_events",["occurred_at"])

def downgrade():
    op.drop_index("ix_seismic_events_occurred_at",table_name="seismic_events")
    op.drop_table("seismic_events")
    op.drop_table("data_sources")
