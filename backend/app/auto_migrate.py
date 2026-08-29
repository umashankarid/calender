"""Auto-migration — safely add missing columns and tables on every startup.

Every migration is idempotent — safe to run multiple times.
Each migration runs in its own transaction to prevent one failure
from rolling back others.
"""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

# Each migration is a single SQL statement (asyncpg requires one statement per execute)
MIGRATIONS = [
    # ── Event member acceptance status ──────────────────────
    (
        "event_members.status",
        "ALTER TABLE event_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'",
    ),
    (
        "event_members.accepted_by_id",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'event_members' AND column_name = 'accepted_by_id'
            ) THEN
                ALTER TABLE event_members
                ADD COLUMN accepted_by_id UUID REFERENCES workspace_users(id) ON DELETE SET NULL;
            END IF;
        END $$
        """,
    ),
    # ── Shopping items ──────────────────────────────────────
    (
        "shopping_items table",
        """
        CREATE TABLE IF NOT EXISTS shopping_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            quantity VARCHAR(50),
            category VARCHAR(50),
            is_bought BOOLEAN NOT NULL DEFAULT FALSE,
            added_by_id UUID REFERENCES workspace_users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
    ),
    (
        "shopping_items workspace_id index",
        "CREATE INDEX IF NOT EXISTS ix_shopping_items_workspace_id ON shopping_items (workspace_id)",
    ),
    (
        "shopping_items is_bought index",
        "CREATE INDEX IF NOT EXISTS ix_shopping_items_is_bought ON shopping_items (is_bought)",
    ),
    # ── Calendar connections (Google Calendar sync) ─────────
    (
        "calendar_connections table",
        """
        CREATE TABLE IF NOT EXISTS calendar_connections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            member_id UUID REFERENCES workspace_users(id) ON DELETE SET NULL,
            provider VARCHAR(50) NOT NULL DEFAULT 'google',
            calendar_id VARCHAR(255) NOT NULL,
            calendar_name VARCHAR(255),
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
    ),
]


async def auto_migrate(engine: AsyncEngine) -> None:
    """Apply all pending schema changes. Each runs in its own transaction."""
    applied = 0
    failed = 0

    for name, sql in MIGRATIONS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
            applied += 1
        except Exception as e:
            failed += 1
            logger.warning(f"[auto-migrate] {name} — {e}")

    logger.info(f"[auto-migrate] ✓ {applied} applied, {failed} skipped, {len(MIGRATIONS)} total")
