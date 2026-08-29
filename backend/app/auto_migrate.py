"""Auto-migration — safely add missing columns and tables on every startup.

This runs AFTER create_all (which handles new tables) and ensures that
column additions from newer code versions are applied to existing tables.

Every migration is idempotent — safe to run multiple times.
Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+).
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def auto_migrate(conn: AsyncConnection) -> None:
    """Apply all pending schema changes. Safe to run on every startup."""

    migrations = [
        # ── 003: Event member acceptance status ──────────────────────
        {
            "name": "event_members.status",
            "sql": """
                ALTER TABLE event_members
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
            """,
        },
        {
            "name": "event_members.accepted_by_id",
            "sql": """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'event_members' AND column_name = 'accepted_by_id'
                    ) THEN
                        ALTER TABLE event_members
                        ADD COLUMN accepted_by_id UUID REFERENCES workspace_users(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            """,
        },
        # ── 002: Shopping items table ────────────────────────────────
        {
            "name": "shopping_items table",
            "sql": """
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
        },
        {
            "name": "shopping_items indexes",
            "sql": """
                CREATE INDEX IF NOT EXISTS ix_shopping_items_workspace_id
                ON shopping_items (workspace_id);
                CREATE INDEX IF NOT EXISTS ix_shopping_items_is_bought
                ON shopping_items (is_bought);
            """,
        },
        # ── Calendar connections table (for Google Calendar sync) ────
        {
            "name": "calendar_connections table",
            "sql": """
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
        },
    ]

    applied = 0
    for m in migrations:
        try:
            await conn.execute(text(m["sql"]))
            applied += 1
        except Exception as e:
            print(f"[auto-migrate] WARNING: {m['name']} — {e}")

    print(f"[auto-migrate] ✓ {applied}/{len(migrations)} migrations checked")
