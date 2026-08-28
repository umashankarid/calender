"""Announcement routes: list active, create, update, delete."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.announcement import Announcement
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.announcement import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate

router = APIRouter(
    prefix="/workspaces/{slug}/announcements",
    tags=["announcements"],
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
    uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    result = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == uid,
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


@router.get("/", response_model=list[AnnouncementResponse])
async def list_announcements(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List active announcements (not expired)."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Announcement)
        .where(
            Announcement.workspace_id == workspace.id,
            Announcement.is_active == True,  # noqa: E712
            or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
            or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
        )
        .order_by(Announcement.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    slug: str,
    data: AnnouncementCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create an announcement (editor+ only)."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    announcement = Announcement(
        workspace_id=workspace.id,
        title=data.title,
        body=data.body,
        priority=data.priority,
        starts_at=data.starts_at,
        expires_at=data.expires_at,
        created_by_id=member.id,
    )
    db.add(announcement)
    await db.flush()
    await db.refresh(announcement)
    return announcement


@router.put("/{announcement_id}/", response_model=AnnouncementResponse)
async def update_announcement(
    slug: str,
    announcement_id: uuid.UUID,
    data: AnnouncementUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update an announcement."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    result = await db.execute(
        select(Announcement).where(
            Announcement.id == announcement_id,
            Announcement.workspace_id == workspace.id,
        )
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(announcement, field, value)

    await db.flush()
    await db.refresh(announcement)
    return announcement


@router.delete("/{announcement_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    slug: str,
    announcement_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Delete an announcement."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    result = await db.execute(
        select(Announcement).where(
            Announcement.id == announcement_id,
            Announcement.workspace_id == workspace.id,
        )
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    await db.delete(announcement)
    await db.flush()
