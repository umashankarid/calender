"""Seed script — creates a default admin user and workspace if the database is empty.

Run automatically on startup or manually:
    python -m app.seed
"""

import asyncio
import os
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.models.calendar import Calendar


# Defaults — override via environment variables
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@calendarhub.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin")
DEFAULT_WORKSPACE = os.environ.get("DEFAULT_WORKSPACE_NAME", "Home")
DEFAULT_WORKSPACE_SLUG = os.environ.get("DEFAULT_WORKSPACE_SLUG", "home")


async def seed():
    """Create default admin + workspace if no users exist yet."""
    async with async_session() as db:
        # Check if any users exist
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is not None:
            print("[seed] Users already exist — skipping seed.")
            return

        print(f"[seed] Creating default admin: {ADMIN_EMAIL}")

        # Create admin user
        user = User(
            id=uuid.uuid4(),
            email=ADMIN_EMAIL,
            name=ADMIN_NAME,
            password_hash=hash_password(ADMIN_PASSWORD),
        )
        db.add(user)
        await db.flush()

        # Create default workspace
        workspace = Workspace(
            id=uuid.uuid4(),
            name=DEFAULT_WORKSPACE,
            slug=DEFAULT_WORKSPACE_SLUG,
            workspace_type="family",
        )
        db.add(workspace)
        await db.flush()

        # Add user as owner
        workspace_user = WorkspaceUser(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            role="owner",
            display_name=ADMIN_NAME,
            display_color="#3B82F6",
        )
        db.add(workspace_user)
        await db.flush()

        # Create a default calendar
        calendar = Calendar(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            name="Family",
            color="#3B82F6",
            is_default=True,
        )
        db.add(calendar)

        await db.commit()
        print(f"[seed] Created admin '{ADMIN_EMAIL}' with workspace '/{DEFAULT_WORKSPACE_SLUG}'")
        print(f"[seed] ⚠️  Change the default password immediately!")


async def main():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
