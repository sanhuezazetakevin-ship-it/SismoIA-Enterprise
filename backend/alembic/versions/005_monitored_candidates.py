"""Phase 8: idempotent monitored candidates and monitoring run logs."""
from alembic import op
import sqlalchemy as sa
revision='005'
down_revision='004'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('monitor_candidates',
        sa.Column('event_key',sa.String(200),primary_key=True),
        sa.Column('alert_id',sa.String(36),sa.ForeignKey('alerts.id'),nullable=False,unique=True),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_table('monitor_runs',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('started_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('finished_at',sa.DateTime(timezone=True)),
        sa.Column('actor_id',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('status',sa.String(24),nullable=False),
        sa.Column('minimum_magnitude',sa.Float(),nullable=False),
        sa.Column('days',sa.Integer(),nullable=False),
        sa.Column('examined',sa.Integer(),nullable=False),
        sa.Column('created',sa.Integer(),nullable=False),
        sa.Column('duplicates',sa.Integer(),nullable=False),
        sa.Column('reason',sa.String(250)))

def downgrade():
    op.drop_table('monitor_runs')
    op.drop_table('monitor_candidates')
