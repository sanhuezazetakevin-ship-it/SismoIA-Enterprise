"""Add isolated identity, sessions, RBAC and audit schema; no changes to migration 001."""
from alembic import op
import sqlalchemy as sa
revision='002'
down_revision='001'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('users', sa.Column('id',sa.String(36),primary_key=True),sa.Column('email',sa.String(254),nullable=False),sa.Column('full_name',sa.String(150),nullable=False),sa.Column('password_hash',sa.Text(),nullable=False),sa.Column('is_active',sa.Boolean(),nullable=False),sa.Column('token_version',sa.Integer(),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_users_email','users',['email'],unique=True)
    op.create_table('roles',sa.Column('id',sa.String(36),primary_key=True),sa.Column('code',sa.String(40),unique=True,nullable=False),sa.Column('description',sa.String(150),nullable=False))
    op.create_table('permissions',sa.Column('id',sa.String(36),primary_key=True),sa.Column('code',sa.String(100),unique=True,nullable=False))
    op.create_table('user_roles',sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),primary_key=True),sa.Column('role_id',sa.String(36),sa.ForeignKey('roles.id',ondelete='CASCADE'),primary_key=True))
    op.create_table('role_permissions',sa.Column('role_id',sa.String(36),sa.ForeignKey('roles.id',ondelete='CASCADE'),primary_key=True),sa.Column('permission_id',sa.String(36),sa.ForeignKey('permissions.id',ondelete='CASCADE'),primary_key=True))
    op.create_table('auth_sessions',sa.Column('id',sa.String(36),primary_key=True),sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('refresh_hash',sa.String(64),unique=True,nullable=False),sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False),sa.Column('revoked_at',sa.DateTime(timezone=True)),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_auth_sessions_user_id','auth_sessions',['user_id'])
    op.create_table('audit_logs',sa.Column('id',sa.String(36),primary_key=True),sa.Column('actor_id',sa.String(36)),sa.Column('action',sa.String(80),nullable=False),sa.Column('target_id',sa.String(36)),sa.Column('occurred_at',sa.DateTime(timezone=True),nullable=False),sa.Column('result',sa.String(30),nullable=False))
    op.create_index('ix_audit_logs_actor_id','audit_logs',['actor_id'])

def downgrade():
    op.drop_index('ix_audit_logs_actor_id',table_name='audit_logs');op.drop_table('audit_logs')
    op.drop_index('ix_auth_sessions_user_id',table_name='auth_sessions');op.drop_table('auth_sessions')
    op.drop_table('role_permissions');op.drop_table('user_roles');op.drop_table('permissions');op.drop_table('roles')
    op.drop_index('ix_users_email',table_name='users');op.drop_table('users')
