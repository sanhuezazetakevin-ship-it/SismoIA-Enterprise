"""Minimal monitored alert rules, with geographic bounds and cooldown."""
from alembic import op
import sqlalchemy as sa
revision='008'
down_revision='007'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('alert_rules',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('name',sa.String(100),nullable=False,unique=True),
        sa.Column('min_magnitude',sa.Float(),nullable=False),
        sa.Column('min_lat',sa.Float()),sa.Column('max_lat',sa.Float()),
        sa.Column('min_lon',sa.Float()),sa.Column('max_lon',sa.Float()),
        sa.Column('cooldown_minutes',sa.Integer(),nullable=False,server_default='0'),
        sa.Column('enabled',sa.Boolean(),nullable=False,server_default=sa.false()),
        sa.Column('created_by',sa.String(36),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.add_column('alerts',sa.Column('rule_id',sa.String(36),nullable=True))
    op.create_foreign_key('fk_alerts_rule_id','alerts','alert_rules',['rule_id'],['id'])
    op.create_index('ix_alerts_rule_created','alerts',['rule_id','created_at'])

def downgrade():
    op.drop_index('ix_alerts_rule_created',table_name='alerts')
    op.drop_constraint('fk_alerts_rule_id','alerts',type_='foreignkey')
    op.drop_column('alerts','rule_id')
    op.drop_table('alert_rules')
