"""Event routes: list, get, create, update, delete — with member associations."""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.event import Event, EventMember
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.event import EventCreate, EventUpdate, EventWithMembers
from app.schemas.workspace_user import WorkspaceUserResponse

router = APIRouter(
    prefix="/workspaces/{slug}/events",
    tags=["events"],
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


def event_to_response(event: Event) -> dict:
    """Convert an Event ORM instance (with member_links loaded) to EventWithMembers-compatible dict."""
    members = []
    for link in event.member_links:
        wu = link.workspace_user
        member_data = WorkspaceUserResponse.model_validate(wu).model_dump()
        member_data["event_status"] = link.status  # pending / accepted / declined
        member_data["accepted_by_name"] = None
        if link.accepted_by:
            member_data["accepted_by_name"] = (
                link.accepted_by.display_name
                or (link.accepted_by.user.name if hasattr(link.accepted_by, 'user') and link.accepted_by.user else None)
                or "Someone"
            )
        members.append(member_data)
    data = EventWithMembers.model_validate(event).model_dump()
    data["members"] = members
    # Overall event acceptance status
    if not members:
        data["acceptance_status"] = "no_members"
    elif any(m["event_status"] == "accepted" for m in members):
        data["acceptance_status"] = "accepted"
    elif any(m["event_status"] == "declined" for m in members):
        data["acceptance_status"] = "declined"
    else:
        data["acceptance_status"] = "pending"
    return data


async def _set_event_members(
    event: Event,
    member_ids: list[uuid.UUID],
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Replace the event's member associations with the given member_ids."""
    # Clear existing
    existing = await db.execute(
        select(EventMember).where(EventMember.event_id == event.id)
    )
    for link in existing.scalars().all():
        await db.delete(link)
    await db.flush()

    # Create new links — validate they belong to the workspace
    if member_ids:
        result = await db.execute(
            select(WorkspaceUser).where(
                WorkspaceUser.id.in_(member_ids),
                WorkspaceUser.workspace_id == workspace_id,
            )
        )
        valid_members = {m.id for m in result.scalars().all()}
        for mid in member_ids:
            if mid not in valid_members:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Member {mid} not found in workspace",
                )
            db.add(EventMember(event_id=event.id, workspace_user_id=mid))
        await db.flush()


async def _load_event_with_members(event_id: uuid.UUID, db: AsyncSession) -> Event:
    """Reload an event with member_links -> workspace_user -> user eagerly loaded."""
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.member_links).selectinload(EventMember.workspace_user).selectinload(WorkspaceUser.user), selectinload(Event.member_links).selectinload(EventMember.accepted_by)
        )
        .where(Event.id == event_id)
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[EventWithMembers])
async def list_events(
    slug: str,
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    calendar_id: Optional[uuid.UUID] = Query(None),
    member_id: Optional[uuid.UUID] = Query(None),
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List events with optional filters. Returns events with members."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    query = (
        select(Event)
        .options(
            selectinload(Event.member_links).selectinload(EventMember.workspace_user).selectinload(WorkspaceUser.user), selectinload(Event.member_links).selectinload(EventMember.accepted_by)
        )
        .where(Event.workspace_id == workspace.id)
    )

    if start is not None:
        query = query.where(Event.start >= start)
    if end is not None:
        query = query.where(Event.start <= end)
    if calendar_id is not None:
        query = query.where(Event.calendar_id == calendar_id)
    if member_id is not None:
        query = query.join(EventMember).where(EventMember.workspace_user_id == member_id)

    query = query.order_by(Event.start)
    result = await db.execute(query)
    events = result.scalars().unique().all()

    return [_build_event_with_members(e) for e in events]


@router.get("/{event_id}/", response_model=EventWithMembers)
async def get_event(
    slug: str,
    event_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get a single event with members."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.member_links).selectinload(EventMember.workspace_user).selectinload(WorkspaceUser.user), selectinload(Event.member_links).selectinload(EventMember.accepted_by)
        )
        .where(Event.id == event_id, Event.workspace_id == workspace.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return _build_event_with_members(event)


@router.post("/", response_model=EventWithMembers, status_code=status.HTTP_201_CREATED)
async def create_event(
    slug: str,
    data: EventCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create an event with optional member_ids (editor+ only)."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    event = Event(
        workspace_id=workspace.id,
        title=data.title,
        start=data.start,
        end=data.end,
        all_day=data.all_day,
        location=data.location,
        notes=data.notes,
        recurrence=data.recurrence,
        calendar_id=data.calendar_id,
    )
    db.add(event)
    await db.flush()

    if data.member_ids:
        await _set_event_members(event, data.member_ids, workspace.id, db)

    loaded = await _load_event_with_members(event.id, db)
    return _build_event_with_members(loaded)


@router.put("/{event_id}/", response_model=EventWithMembers)
async def update_event(
    slug: str,
    event_id: uuid.UUID,
    data: EventUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update an event, including member_ids replacement."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.workspace_id == workspace.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    update_data = data.model_dump(exclude_unset=True)
    member_ids = update_data.pop("member_ids", None)

    for field, value in update_data.items():
        setattr(event, field, value)
    await db.flush()

    if member_ids is not None:
        await _set_event_members(event, member_ids, workspace.id, db)

    loaded = await _load_event_with_members(event.id, db)
    return _build_event_with_members(loaded)


@router.delete("/{event_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    slug: str,
    event_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Delete an event."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.workspace_id == workspace.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await db.delete(event)
    await db.flush()


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------


def _build_event_with_members(event: Event) -> dict:
    """Build a dict compatible with EventWithMembers from an ORM Event
    with member_links eagerly loaded."""
    members = []
    for link in event.member_links:
        members.append(WorkspaceUserResponse.model_validate(link.workspace_user))

    resp = EventWithMembers.model_validate(event)
    resp.members = members
    return resp


@router.put("/{event_id}/respond/", response_model=EventWithMembers)
async def respond_to_event(
    slug: str,
    event_id: uuid.UUID,
    response: str = Query(..., description="accepted or declined"),
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Accept or decline an event. Any workspace member can respond."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)

    if response not in ("accepted", "declined"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response must be 'accepted' or 'declined'",
        )

    # Find the event
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.member_links)
            .selectinload(EventMember.workspace_user)
            .selectinload(WorkspaceUser.user)
        )
        .where(Event.id == event_id, Event.workspace_id == workspace.id)
    )
    event = result.unique().scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Update all member links for this event — the responder is accepting responsibility
    for link in event.member_links:
        link.status = response
        if response == "accepted":
            link.accepted_by_id = member.id
        else:
            link.accepted_by_id = None

    await db.flush()

    # Reload
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.member_links)
            .selectinload(EventMember.workspace_user)
            .selectinload(WorkspaceUser.user)
        )
        .where(Event.id == event.id)
    )
    event = result.unique().scalar_one()
    return event_to_response(event)
