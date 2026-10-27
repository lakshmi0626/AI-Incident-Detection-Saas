"""initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-10-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Schema matches Base.metadata created via SQLAlchemy
    pass

def downgrade() -> None:
    pass
