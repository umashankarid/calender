"""Workspace member routes: list, invite, update role, remove."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.workspace_user import (
    WorkspaceUserCreate,
    WorkspaceUserResponse,
    WorkspaceUserUpdate,
)

router = APIRouter(
    prefix="/workspaces/{slug}/members",
    tags=["members"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def get_workspace(slug: str, db: AsyncSession) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.slug == slug))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


async def get_workspace_member(
    workspace_id: uuid.UUID, user_id: str, db: AsyncSession
) -> WorkspaceUser:
    result = await db.execute(
        select(WorkspaceUser)
        .options(selectinload(WorkspaceUser.user))
        .where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace",
        )
    return member


def check_role(member: WorkspaceUser, min_role: str) -> None:
    min_level = ROLE_HIERARCHY.get(min_role, 0)
    user_level = ROLE_HIERARCHY.get(member.role, -1)
    if user_level < min_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires at least '{min_role}' role",
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[WorkspaceUserResponse])
async def list_members(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List all members of a workspace."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(WorkspaceUser)
        .options(selectinload(WorkspaceUser.user))
        .where(WorkspaceUser.workspace_id == workspace.id)
    )
    return result.scalars().all()


@router.post("/", response_model=WorkspaceUserResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    slug: str,
    data: WorkspaceUserCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user by email. Creates user account if needed."""
    workspace = await get_workspace(slug, db)
    current = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(current, "admin")

    # Find or create user
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user is None:
        # Create a placeholder user with a random password
        user = User(
            email=data.email,
            name=data.display_name or data.email.split("@")[0],
            password_hash=hash_password(uuid.uuid4().hex),
        )
        db.add(user)
        await db.flush()

    # Check if already a member
    existing = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == workspace.id,
            WorkspaceUser.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this workspace",
        )

    member = WorkspaceUser(
        workspace_id=workspace.id,
        user_id=user.id,
        role=data.role,
        display_name=data.display_name,
        display_color=data.display_color or "#3B82F6",
    )
    db.add(member)
    await db.flush()

    # Reload with user relationship
    result = await db.execute(
        select(WorkspaceUser)
        .options(selectinload(WorkspaceUser.user))
        .where(WorkspaceUser.id == member.id)
    )
    return result.scalar_one()


@router.put("/{member_id}/", response_model=WorkspaceUserResponse)
async def update_member(
    slug: str,
    member_id: uuid.UUID,
    data: WorkspaceUserUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update a member's role, display_name, or color (admin+ only)."""
    workspace = await get_workspace(slug, db)
    current = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(current, "admin")

    result = await db.execute(
        select(WorkspaceUser)
        .options(selectinload(WorkspaceUser.user))
        .where(
            WorkspaceUser.id == member_id,
            WorkspaceUser.workspace_id == workspace.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    await db.flush()
    await db.refresh(member)
    # Reload user relationship
    result = await db.execute(
        select(WorkspaceUser)
        .options(selectinload(WorkspaceUser.user))
        .where(WorkspaceUser.id == member.id)
    )
    return result.scalar_one()


@router.delete("/{member_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    slug: str,
    member_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the workspace (admin+ only, can't remove last owner)."""
    workspace = await get_workspace(slug, db)
    current = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(current, "admin")

    result = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.id == member_id,
            WorkspaceUser.workspace_id == workspace.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Prevent removing the last owner
    if member.role == "owner":
        owner_count = await db.execute(
            select(func.count())
            .select_from(WorkspaceUser)
            .where(
                WorkspaceUser.workspace_id == workspace.id,
                WorkspaceUser.role == "owner",
            )
        )
        if owner_count.scalar_one() <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner of the workspace",
            )

    await db.delete(member)
    await db.flush()
