"""Entrega A: trazabilidad de consultas USGS y eventos retenidos selectivamente."""
from alembic import op
import sqlalchemy as sa
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('usgs_query_snapshots',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('source',sa.String(30),nullable=False),
        sa.Column('purpose',sa.String(30),nullable=False),
        sa.Column('queried_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('period_start',sa.DateTime(timezone=True),nullable=False),
        sa.Column('period_end',sa.DateTime(timezone=True),nullable=False),
        sa.Column('query_params',sa.JSON(),nullable=False),
        sa.Column('result_hash',sa.String(64)),
        sa.Column('event_count',sa.Integer(),nullable=False),
        sa.Column('skipped_count',sa.Integer(),nullable=False),
        sa.Column('status',sa.String(20),nullable=False),
        sa.Column('error_summary',sa.String(250)),
        sa.Column('actor_id',sa.String(36),sa.ForeignKey('users.id')))
    op.create_index('ix_usgs_query_snapshots_queried_at','usgs_query_snapshots',['queried_at'])
    op.create_table('usgs_event_snapshots',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('query_id',sa.String(36),sa.ForeignKey('usgs_query_snapshots.id'),nullable=False),
        sa.Column('external_id',sa.String(200),nullable=False),
        sa.Column('occurred_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('magnitude',sa.Float()),sa.Column('depth_km',sa.Float()),
        sa.Column('latitude',sa.Float(),nullable=False),sa.Column('longitude',sa.Float(),nullable=False),
        sa.Column('source_url',sa.String(1000)),sa.Column('event_hash',sa.String(64),nullable=False),
        sa.Column('data',sa.JSON(),nullable=False),
        sa.UniqueConstraint('query_id','external_id',name='uq_usgs_snapshot_query_event'))
    op.create_index('ix_usgs_event_snapshots_query_id','usgs_event_snapshots',['query_id'])

def downgrade():
    op.drop_index('ix_usgs_event_snapshots_query_id',table_name='usgs_event_snapshots')
    op.drop_table('usgs_event_snapshots')
    op.drop_index('ix_usgs_query_snapshots_queried_at',table_name='usgs_query_snapshots')
    op.drop_table('usgs_query_snapshots')
