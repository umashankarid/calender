"""Display routes: CRUD, pairing, widgets, SSE feed, and token-based today endpoint."""

import asyncio
import json
import random
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.announcement import Announcement
from app.models.display import Display, DisplayWidget
from app.models.event import Event, EventMember
from app.models.reminder import Reminder
from app.models.shopping_item import ShoppingItem
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.display import (
    DisplayCreate,
    DisplayResponse,
    DisplayUpdate,
    DisplayWidgetCreate,
    DisplayWidgetResponse,
)

router = APIRouter(
    prefix="/workspaces/{slug}/displays",
    tags=["displays"],
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
        select(WorkspaceUser).where(
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


def _generate_pairing_code() -> str:
    """Generate a 6-digit numeric pairing code."""
    return "".join(random.choices(string.digits, k=6))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[DisplayResponse])
async def list_displays(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List all displays for a workspace."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Display).where(Display.workspace_id == workspace.id)
    )
    return result.scalars().all()


@router.post("/", response_model=DisplayResponse, status_code=status.HTTP_201_CREATED)
async def create_display(
    slug: str,
    data: DisplayCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Register a new display with a unique token and 6-digit pairing code."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    display = Display(
        workspace_id=workspace.id,
        name=data.name,
        token=secrets.token_urlsafe(32),
        pairing_code=_generate_pairing_code(),
        pairing_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(display)
    await db.flush()
    await db.refresh(display)
    return display


class PairRequest(BaseModel):
    pairing_code: str


@router.post("/pair/")
async def pair_display(
    slug: str,
    data: PairRequest,
    db: AsyncSession = Depends(get_db),
):
    """Pair a display using its pairing code. Called from the display device.
    No JWT required — pairing code acts as auth."""
    workspace = await get_workspace(slug, db)

    result = await db.execute(
        select(Display).where(
            Display.workspace_id == workspace.id,
            Display.pairing_code == data.pairing_code,
        )
    )
    display = result.scalar_one_or_none()
    if display is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid pairing code")

    if display.pairing_expires_at:
        expires = display.pairing_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Pairing code has expired")

    display.is_paired = True
    display.pairing_code = None
    display.pairing_expires_at = None
    await db.flush()
    await db.refresh(display)

    return {"display_id": str(display.id), "token": display.token, "name": display.name}


@router.get("/by-token/{token}/today/")
async def get_today_by_token(
    slug: str,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Get today's data for a display using its token (no JWT needed, read-only).

    Returns: date, workspace info, today's events grouped by member,
    upcoming events, active announcements, pending reminders.
    """
    workspace = await get_workspace(slug, db)

    # Validate display token
    result = await db.execute(
        select(Display).where(
            Display.token == token,
            Display.workspace_id == workspace.id,
        )
    )
    display = result.scalar_one_or_none()
    if display is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display not found")

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Today's events with members
    # NOTE: This includes Google-synced events (source='google') automatically
    #       since they are stored in the same events table.
    events_result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.member_links)
            .selectinload(EventMember.workspace_user)
            .selectinload(WorkspaceUser.user),
            selectinload(Event.member_links)
            .selectinload(EventMember.accepted_by)
        )
        .where(
            Event.workspace_id == workspace.id,
            Event.start >= today_start,
            Event.start < today_end,
        )
        .order_by(Event.start)
    )
    todays_events = events_result.scalars().unique().all()

    # Group events by member
    events_by_member: dict[str, list] = {}
    for event in todays_events:
        event_data = {
            "id": str(event.id),
            "title": event.title,
            "start": event.start.isoformat(),
            "end": event.end.isoformat() if event.end else None,
            "all_day": event.all_day,
            "location": event.location,
        }
        if not event.member_links:
            events_by_member.setdefault("unassigned", []).append(event_data)
        else:
            for link in event.member_links:
                wu = link.workspace_user
                member_name = wu.display_name or wu.user.name
                events_by_member.setdefault(member_name, []).append(event_data)

    # Upcoming events (next 7 days, excluding today)
    upcoming_end = today_start + timedelta(days=7)
    upcoming_result = await db.execute(
        select(Event)
        .where(
            Event.workspace_id == workspace.id,
            Event.start >= today_end,
            Event.start < upcoming_end,
        )
        .order_by(Event.start)
        .limit(20)
    )
    upcoming_events = [
        {
            "id": str(e.id),
            "title": e.title,
            "start": e.start.isoformat(),
            "end": e.end.isoformat() if e.end else None,
            "all_day": e.all_day,
        }
        for e in upcoming_result.scalars().all()
    ]

    # Active announcements
    ann_result = await db.execute(
        select(Announcement)
        .where(
            Announcement.workspace_id == workspace.id,
            Announcement.is_active == True,  # noqa: E712
            or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
            or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
        )
        .order_by(Announcement.created_at.desc())
    )
    announcements = [
        {
            "id": str(a.id),
            "title": a.title,
            "body": a.body,
            "priority": a.priority,
        }
        for a in ann_result.scalars().all()
    ]

    # Pending reminders for today
    rem_result = await db.execute(
        select(Reminder)
        .join(Event, Reminder.event_id == Event.id)
        .where(
            Event.workspace_id == workspace.id,
            Reminder.status == "pending",
            Reminder.remind_at >= today_start,
            Reminder.remind_at < today_end,
        )
        .order_by(Reminder.remind_at)
    )
    reminders = [
        {
            "id": str(r.id),
            "event_id": str(r.event_id),
            "remind_at": r.remind_at.isoformat(),
            "message": r.message,
        }
        for r in rem_result.scalars().all()
    ]

    # Shopping list — unbought items
    shopping_result = await db.execute(
        select(ShoppingItem)
        .where(
            ShoppingItem.workspace_id == workspace.id,
            ShoppingItem.is_bought == False,  # noqa: E712
        )
        .order_by(ShoppingItem.created_at)
    )
    shopping_list = [
        {
            "id": str(s.id),
            "name": s.name,
            "quantity": s.quantity,
            "category": s.category,
            "is_bought": s.is_bought,
            "added_by_id": str(s.added_by_id) if s.added_by_id else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in shopping_result.scalars().all()
    ]

    return {
        "date": today_start.date().isoformat(),
        "workspace": {
            "name": workspace.name,
            "slug": workspace.slug,
            "primary_color": workspace.primary_color,
            "timezone": workspace.timezone,
        },
        "workspace_name": workspace.name,
        "display_id": str(display.id),
        "today": [
            {
                "id": str(e.id),
                "workspace_id": str(e.workspace_id),
                "calendar_id": str(e.calendar_id) if e.calendar_id else None,
                "title": e.title,
                "start": e.start.isoformat(),
                "end": e.end.isoformat() if e.end else None,
                "all_day": e.all_day,
                "location": e.location,
                "notes": e.notes,
                "recurrence": e.recurrence,
                "source": e.source,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "updated_at": e.updated_at.isoformat() if e.updated_at else None,
                "members": [
                    {
                        "id": str(link.workspace_user.id),
                        "workspace_id": str(link.workspace_user.workspace_id),
                        "user_id": str(link.workspace_user.user_id),
                        "role": link.workspace_user.role,
                        "display_name": link.workspace_user.display_name
                            or (link.workspace_user.user.name if link.workspace_user.user else None),
                        "display_color": link.workspace_user.display_color,
                        "created_at": link.workspace_user.created_at.isoformat()
                            if link.workspace_user.created_at else None,
                        "event_status": link.status,
                        "accepted_by_name": (
                            link.accepted_by.display_name
                            or (link.accepted_by.user.name if hasattr(link.accepted_by, 'user') and link.accepted_by.user else None)
                        ) if link.accepted_by else None,
                    }
                    for link in e.member_links
                ],
                "acceptance_status": (
                    "accepted" if any(link.status == "accepted" for link in e.member_links)
                    else "declined" if any(link.status == "declined" for link in e.member_links)
                    else "pending" if e.member_links
                    else "no_members"
                ),
            }
            for e in todays_events
        ],
        "upcoming": upcoming_events,
        "announcements": announcements,
        "reminders": reminders,
        "shopping_list": shopping_list,
    }


@router.get("/{display_id}/", response_model=DisplayResponse)
async def get_display(
    slug: str,
    display_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get a display's configuration."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Display).where(
            Display.id == display_id,
            Display.workspace_id == workspace.id,
        )
    )
    display = result.scalar_one_or_none()
    if display is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display not found")
    return display


@router.put("/{display_id}/", response_model=DisplayResponse)
async def update_display(
    slug: str,
    display_id: uuid.UUID,
    data: DisplayUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update display name/layout."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Display).where(
            Display.id == display_id,
            Display.workspace_id == workspace.id,
        )
    )
    display = result.scalar_one_or_none()
    if display is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(display, field, value)

    await db.flush()
    await db.refresh(display)
    return display


@router.put("/{display_id}/widgets/", response_model=list[DisplayWidgetResponse])
async def bulk_update_widgets(
    slug: str,
    display_id: uuid.UUID,
    widgets: list[DisplayWidgetCreate],
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Bulk update (replace) widgets for a display."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Display).where(
            Display.id == display_id,
            Display.workspace_id == workspace.id,
        )
    )
    display = result.scalar_one_or_none()
    if display is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display not found")

    # Delete existing widgets
    existing = await db.execute(
        select(DisplayWidget).where(DisplayWidget.display_id == display.id)
    )
    for w in existing.scalars().all():
        await db.delete(w)
    await db.flush()

    # Create new widgets
    new_widgets = []
    for w_data in widgets:
        widget = DisplayWidget(
            display_id=display.id,
            widget_type=w_data.widget_type,
            position=w_data.position,
            config=w_data.config,
            is_visible=w_data.is_visible,
        )
        db.add(widget)
        new_widgets.append(widget)

    await db.flush()
    for w in new_widgets:
        await db.refresh(w)

    return new_widgets


@router.get("/{display_id}/feed/")
async def display_feed(
    slug: str,
    display_id: uuid.UUID,
    request: Request,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """SSE stream for real-time updates. Accepts display token query param OR JWT Bearer.

    Display devices authenticate with ?token=<display_token>.
    Browser/admin users can also use JWT Bearer auth.
    """
    from app.core.auth import bearer_scheme, verify_token as _verify_token

    workspace = await get_workspace(slug, db)

    # Validate display exists and belongs to workspace
    result = await db.execute(
        select(Display).where(
            Display.id == display_id,
            Display.workspace_id == workspace.id,
        )
    )
    display = result.scalar_one_or_none()
    if display is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display not found")

    # Authenticate: display token OR JWT
    authenticated = False
    if token is not None:
        if token == display.token:
            authenticated = True
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid display token")

    if not authenticated:
        # Try JWT from Authorization header
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            jwt_token = auth_header[7:]
            payload = _verify_token(jwt_token)  # raises 401 if invalid
            await get_workspace_member(workspace.id, payload["sub"], db)
            authenticated = True

    if not authenticated:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    async def event_generator():
        """Yield SSE events. Sends a heartbeat every 30 seconds."""
        try:
            while True:
                if await request.is_disconnected():
                    break
                # Send heartbeat / keepalive
                yield f"event: heartbeat\ndata: {json.dumps({'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
                await asyncio.sleep(30)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
