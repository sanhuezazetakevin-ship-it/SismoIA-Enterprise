"""Add ingestion history and revision metadata. Does not modify auth data."""
from alembic import op
import sqlalchemy as sa
revision='003'
down_revision='002'
branch_labels=None
depends_on=None

def upgrade():
    op.add_column('data_sources',sa.Column('last_sync_at',sa.DateTime(timezone=True),nullable=True))
    op.add_column('seismic_events',sa.Column('source_updated_at',sa.DateTime(timezone=True),nullable=True))
    op.add_column('seismic_events',sa.Column('raw_payload',sa.JSON(),nullable=True))
    op.create_table('ingestion_runs',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('source_id',sa.String(36),sa.ForeignKey('data_sources.id'),nullable=False),
        sa.Column('started_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('finished_at',sa.DateTime(timezone=True)),
        sa.Column('status',sa.String(24),nullable=False),
        sa.Column('records_seen',sa.Integer(),nullable=False,server_default='0'),
        sa.Column('records_inserted',sa.Integer(),nullable=False,server_default='0'),
        sa.Column('records_updated',sa.Integer(),nullable=False,server_default='0'),
        sa.Column('records_skipped',sa.Integer(),nullable=False,server_default='0'),
        sa.Column('error_summary',sa.String(300)))
    op.create_index('ix_ingestion_runs_source_id','ingestion_runs',['source_id'])

def downgrade():
    op.drop_index('ix_ingestion_runs_source_id',table_name='ingestion_runs')
    op.drop_table('ingestion_runs')
    op.drop_column('seismic_events','raw_payload')
    op.drop_column('seismic_events','source_updated_at')
    op.drop_column('data_sources','last_sync_at')
