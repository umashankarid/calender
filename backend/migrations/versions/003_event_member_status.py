"""Add status and accepted_by_id to event_members

Revision ID: 003
Revises: 002
Create Date: 2026-08-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event_members",
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
    )
    op.add_column(
        "event_members",
        sa.Column(
            "accepted_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspace_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("event_members", "accepted_by_id")
    op.drop_column("event_members", "status")
