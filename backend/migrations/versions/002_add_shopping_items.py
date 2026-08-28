"""Add shopping_items table

Revision ID: 002
Revises: 001
Create Date: 2026-08-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shopping_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.String(50), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column(
            "is_bought", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "added_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspace_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_shopping_items_workspace_id", "shopping_items", ["workspace_id"]
    )
    op.create_index(
        "ix_shopping_items_is_bought", "shopping_items", ["is_bought"]
    )


def downgrade() -> None:
    op.drop_table("shopping_items")
