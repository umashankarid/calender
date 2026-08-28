"""Calendar routes: list, create, update, delete."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.calendar import Calendar
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.calendar import CalendarCreate, CalendarResponse, CalendarUpdate

router = APIRouter(
    prefix="/workspaces/{slug}/calendars",
    tags=["calendars"],
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


@router.get("/", response_model=list[CalendarResponse])
async def list_calendars(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List all calendars in a workspace."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Calendar).where(Calendar.workspace_id == workspace.id)
    )
    return result.scalars().all()


@router.post("/", response_model=CalendarResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar(
    slug: str,
    data: CalendarCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create a new calendar (editor+ only)."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    calendar = Calendar(
        workspace_id=workspace.id,
        name=data.name,
        color=data.color,
        is_default=data.is_default,
    )
    db.add(calendar)
    await db.flush()
    await db.refresh(calendar)
    return calendar


@router.put("/{calendar_id}", response_model=CalendarResponse)
async def update_calendar(
    slug: str,
    calendar_id: uuid.UUID,
    data: CalendarUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update a calendar."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    result = await db.execute(
        select(Calendar).where(
            Calendar.id == calendar_id,
            Calendar.workspace_id == workspace.id,
        )
    )
    calendar = result.scalar_one_or_none()
    if calendar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(calendar, field, value)

    await db.flush()
    await db.refresh(calendar)
    return calendar


@router.delete("/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar(
    slug: str,
    calendar_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Delete a calendar."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    result = await db.execute(
        select(Calendar).where(
            Calendar.id == calendar_id,
            Calendar.workspace_id == workspace.id,
        )
    )
    calendar = result.scalar_one_or_none()
    if calendar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")

    await db.delete(calendar)
    await db.flush()
