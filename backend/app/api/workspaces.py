"""Workspace routes: create, list, get, update."""

import uuid as _uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def get_workspace(slug: str, db: AsyncSession) -> Workspace:
    """Resolve a workspace by its slug; raise 404 if not found."""
    result = await db.execute(select(Workspace).where(Workspace.slug == slug))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    return workspace


async def get_workspace_member(
    workspace_id: _uuid.UUID,
    user_id: str,
    db: AsyncSession,
) -> WorkspaceUser:
    """Get WorkspaceUser for the given workspace + user, or 403."""
    result = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == _uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
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
    """Raise 403 if the member doesn't meet the minimum role."""
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


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace and add the creator as owner."""
    user_id = _uuid.UUID(payload["sub"])
    existing = await db.execute(select(Workspace).where(Workspace.slug == data.slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A workspace with this slug already exists",
        )

    workspace = Workspace(
        name=data.name,
        slug=data.slug,
        workspace_type=data.workspace_type,
        timezone=data.timezone,
    )
    db.add(workspace)
    await db.flush()

    # Automatically add creator as owner
    owner = WorkspaceUser(
        workspace_id=workspace.id,
        user_id=user_id,
        role="owner",
    )
    db.add(owner)
    await db.flush()
    await db.refresh(workspace)
    return workspace


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List all workspaces the current user belongs to."""
    user_id = _uuid.UUID(payload["sub"])
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceUser, WorkspaceUser.workspace_id == Workspace.id)
        .where(WorkspaceUser.user_id == user_id)
    )
    return result.scalars().all()


@router.get("/{slug}/", response_model=WorkspaceResponse)
async def get_workspace_by_slug(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get a workspace by slug (must be a member)."""
    workspace = await get_workspace(slug, db)
    user_id = payload["sub"]
    await get_workspace_member(workspace.id, user_id, db)
    return workspace


@router.put("/{slug}/", response_model=WorkspaceResponse)
async def update_workspace(
    slug: str,
    data: WorkspaceUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update workspace details (owner/admin only)."""
    workspace = await get_workspace(slug, db)
    user_id = payload["sub"]
    member = await get_workspace_member(workspace.id, user_id, db)
    check_role(member, "admin")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(workspace, field, value)

    await db.flush()
    await db.refresh(workspace)
    return workspace
