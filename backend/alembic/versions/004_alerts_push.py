"""Phase 7: manually approved informational alerts and Android push devices."""
from alembic import op
import sqlalchemy as sa
revision='004'
down_revision='003'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('alerts',sa.Column('id',sa.String(36),primary_key=True),sa.Column('source',sa.String(24),nullable=False),sa.Column('external_event_id',sa.String(150),nullable=False),sa.Column('title',sa.String(140),nullable=False),sa.Column('body',sa.String(500),nullable=False),sa.Column('status',sa.String(24),nullable=False),sa.Column('created_by',sa.String(36),sa.ForeignKey('users.id'),nullable=False),sa.Column('approved_by',sa.String(36),sa.ForeignKey('users.id')),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('approved_at',sa.DateTime(timezone=True)),sa.Column('sent_at',sa.DateTime(timezone=True)))
    op.create_index('ix_alerts_status','alerts',['status'])
    op.create_table('alert_reviews',sa.Column('id',sa.String(36),primary_key=True),sa.Column('alert_id',sa.String(36),sa.ForeignKey('alerts.id',ondelete='CASCADE'),nullable=False),sa.Column('actor_id',sa.String(36),sa.ForeignKey('users.id'),nullable=False),sa.Column('decision',sa.String(24),nullable=False),sa.Column('note',sa.String(500)),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_alert_reviews_alert_id','alert_reviews',['alert_id'])
    op.create_table('push_devices',sa.Column('id',sa.String(36),primary_key=True),sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('token_hash',sa.String(64),nullable=False,unique=True),sa.Column('token',sa.Text,nullable=False),sa.Column('platform',sa.String(20),nullable=False),sa.Column('enabled',sa.Boolean,nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_push_devices_user_id','push_devices',['user_id'])
    op.create_table('push_deliveries',sa.Column('id',sa.String(36),primary_key=True),sa.Column('alert_id',sa.String(36),sa.ForeignKey('alerts.id',ondelete='CASCADE'),nullable=False),sa.Column('device_id',sa.String(36),sa.ForeignKey('push_devices.id'),nullable=False),sa.Column('status',sa.String(24),nullable=False),sa.Column('provider_message_id',sa.String(255)),sa.Column('error',sa.String(300)),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint('alert_id','device_id'))

def downgrade():
    op.drop_table('push_deliveries')
    op.drop_index('ix_push_devices_user_id',table_name='push_devices');op.drop_table('push_devices')
    op.drop_index('ix_alert_reviews_alert_id',table_name='alert_reviews');op.drop_table('alert_reviews')
    op.drop_index('ix_alerts_status',table_name='alerts');op.drop_table('alerts')
