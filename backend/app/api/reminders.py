"""Reminder routes: list, create, update, delete."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.event import Event
from app.models.reminder import Reminder
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.reminder import ReminderCreate, ReminderResponse, ReminderUpdate

router = APIRouter(
    prefix="/workspaces/{slug}/reminders",
    tags=["reminders"],
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[ReminderResponse])
async def list_reminders(
    slug: str,
    event_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List reminders for a workspace, with optional event_id and status filters."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    # Reminders belong to events that belong to the workspace
    query = (
        select(Reminder)
        .join(Event, Reminder.event_id == Event.id)
        .where(Event.workspace_id == workspace.id)
    )

    if event_id is not None:
        query = query.where(Reminder.event_id == event_id)
    if status_filter is not None:
        query = query.where(Reminder.status == status_filter)

    query = query.order_by(Reminder.remind_at)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    slug: str,
    data: ReminderCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create a reminder for an event in this workspace."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    # Verify the event belongs to this workspace
    event_result = await db.execute(
        select(Event).where(Event.id == data.event_id, Event.workspace_id == workspace.id)
    )
    if event_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found in this workspace",
        )

    reminder = Reminder(
        event_id=data.event_id,
        workspace_user_id=data.workspace_user_id,
        remind_at=data.remind_at,
        message=data.message,
    )
    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)
    return reminder


@router.put("/{reminder_id}/", response_model=ReminderResponse)
async def update_reminder(
    slug: str,
    reminder_id: uuid.UUID,
    data: ReminderUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update a reminder."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Reminder)
        .join(Event, Reminder.event_id == Event.id)
        .where(Reminder.id == reminder_id, Event.workspace_id == workspace.id)
    )
    reminder = result.scalar_one_or_none()
    if reminder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reminder, field, value)

    await db.flush()
    await db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    slug: str,
    reminder_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Delete a reminder."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Reminder)
        .join(Event, Reminder.event_id == Event.id)
        .where(Reminder.id == reminder_id, Event.workspace_id == workspace.id)
    )
    reminder = result.scalar_one_or_none()
    if reminder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    await db.delete(reminder)
    await db.flush()
