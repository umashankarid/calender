"""Seed script — ensures the admin user and default workspace exist on every startup.

- If no users exist: creates admin + workspace + calendar from env vars.
- If admin exists: updates email, name, and password from env vars.
- If workspace exists: ensures admin is the owner.

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
    """Ensure admin user and default workspace exist, sync credentials from env."""
    async with async_session() as db:

        # ── Find or create admin user ────────────────────────────────────
        result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        user = result.scalar_one_or_none()

        if user is None:
            # Maybe the email changed — check if there's a user that was
            # previously the admin (first user created by seed)
            result = await db.execute(select(User).order_by(User.created_at).limit(1))
            first_user = result.scalar_one_or_none()

            if first_user is None:
                # Fresh database — create everything
                print(f"[seed] Creating admin: {ADMIN_EMAIL}")
                user = User(
                    id=uuid.uuid4(),
                    email=ADMIN_EMAIL,
                    name=ADMIN_NAME,
                    password_hash=hash_password(ADMIN_PASSWORD),
                )
                db.add(user)
                await db.flush()
            else:
                # Update existing first user to match env vars
                print(f"[seed] Updating admin: {first_user.email} → {ADMIN_EMAIL}")
                first_user.email = ADMIN_EMAIL
                first_user.name = ADMIN_NAME
                first_user.password_hash = hash_password(ADMIN_PASSWORD)
                user = first_user
                await db.flush()
        else:
            # Admin exists with correct email — sync name and password
            print(f"[seed] Syncing admin credentials for {ADMIN_EMAIL}")
            user.name = ADMIN_NAME
            user.password_hash = hash_password(ADMIN_PASSWORD)
            await db.flush()

        # ── Find or create default workspace ─────────────────────────────
        result = await db.execute(
            select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
        )
        workspace = result.scalar_one_or_none()

        if workspace is None:
            print(f"[seed] Creating workspace: /{DEFAULT_WORKSPACE_SLUG}")
            workspace = Workspace(
                id=uuid.uuid4(),
                name=DEFAULT_WORKSPACE,
                slug=DEFAULT_WORKSPACE_SLUG,
                workspace_type="family",
            )
            db.add(workspace)
            await db.flush()

        # ── Ensure admin is owner of workspace ───────────────────────────
        result = await db.execute(
            select(WorkspaceUser).where(
                WorkspaceUser.workspace_id == workspace.id,
                WorkspaceUser.user_id == user.id,
            )
        )
        membership = result.scalar_one_or_none()

        if membership is None:
            print(f"[seed] Adding admin as owner of /{DEFAULT_WORKSPACE_SLUG}")
            membership = WorkspaceUser(
                id=uuid.uuid4(),
                workspace_id=workspace.id,
                user_id=user.id,
                role="owner",
                display_name=ADMIN_NAME,
                display_color="#3B82F6",
            )
            db.add(membership)
            await db.flush()
        else:
            # Sync display name
            membership.display_name = ADMIN_NAME
            if membership.role != "owner":
                membership.role = "owner"
            await db.flush()

        # ── Ensure default calendar exists ───────────────────────────────
        result = await db.execute(
            select(Calendar).where(
                Calendar.workspace_id == workspace.id,
                Calendar.is_default == True,  # noqa: E712
            )
        )
        if result.scalar_one_or_none() is None:
            print(f"[seed] Creating default calendar for /{DEFAULT_WORKSPACE_SLUG}")
            calendar = Calendar(
                id=uuid.uuid4(),
                workspace_id=workspace.id,
                name="Family",
                color="#3B82F6",
                is_default=True,
            )
            db.add(calendar)

        await db.commit()
        print(f"[seed] ✓ Admin '{ADMIN_EMAIL}' ready, workspace '/{DEFAULT_WORKSPACE_SLUG}' ready")


async def main():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
