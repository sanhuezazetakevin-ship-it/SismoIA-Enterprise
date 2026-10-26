"""Auditable on-demand CSV/PDF report generation."""
from alembic import op
import sqlalchemy as sa
revision='009'
down_revision='008'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('report_exports',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('actor_id',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('category',sa.String(24),nullable=False),
        sa.Column('format',sa.String(4),nullable=False),
        sa.Column('filters',sa.JSON(),nullable=False),
        sa.Column('rows_count',sa.Integer(),nullable=False),
        sa.Column('generated_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_report_exports_actor_id','report_exports',['actor_id'])
    op.create_index('ix_report_exports_generated_at','report_exports',['generated_at'])

def downgrade():
    op.drop_index('ix_report_exports_generated_at',table_name='report_exports')
    op.drop_index('ix_report_exports_actor_id',table_name='report_exports')
    op.drop_table('report_exports')
