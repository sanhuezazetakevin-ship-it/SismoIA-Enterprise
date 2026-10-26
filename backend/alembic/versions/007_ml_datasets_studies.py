"""Retrospective ML dataset versions and immutable study results."""
from alembic import op
import sqlalchemy as sa
revision='007'
down_revision='006'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('ml_dataset_versions',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('snapshot_id',sa.String(36),sa.ForeignKey('usgs_query_snapshots.id'),nullable=False),
        sa.Column('content_sha256',sa.String(64),nullable=False),
        sa.Column('row_count',sa.Integer(),nullable=False),
        sa.Column('quality_report',sa.JSON(),nullable=False),
        sa.Column('manifest',sa.JSON(),nullable=False),
        sa.Column('created_by',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),
        sa.UniqueConstraint('snapshot_id','content_sha256',name='uq_ml_dataset_snapshot_hash'))
    op.create_index('ix_ml_dataset_versions_snapshot_id','ml_dataset_versions',['snapshot_id'])
    op.create_table('ml_studies',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('dataset_id',sa.String(36),sa.ForeignKey('ml_dataset_versions.id'),nullable=False),
        sa.Column('kind',sa.String(25),nullable=False),
        sa.Column('algorithm',sa.String(80),nullable=False),
        sa.Column('config',sa.JSON(),nullable=False),
        sa.Column('metrics',sa.JSON(),nullable=False),
        sa.Column('results',sa.JSON(),nullable=False),
        sa.Column('limitations',sa.JSON(),nullable=False),
        sa.Column('created_by',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_ml_studies_dataset_id','ml_studies',['dataset_id'])

def downgrade():
    op.drop_index('ix_ml_studies_dataset_id',table_name='ml_studies')
    op.drop_table('ml_studies')
    op.drop_index('ix_ml_dataset_versions_snapshot_id',table_name='ml_dataset_versions')
    op.drop_table('ml_dataset_versions')
