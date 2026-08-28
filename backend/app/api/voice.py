"""Voice interpretation route: simple keyword/regex NLP for MVP."""

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser

router = APIRouter(
    prefix="/workspaces/{slug}/voice",
    tags=["voice"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas (local to this module)
# ---------------------------------------------------------------------------


class VoiceInput(BaseModel):
    text: str


class VoiceResult(BaseModel):
    intent: str
    data: dict
    confirmation_text: str


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


def _resolve_date(text: str) -> datetime:
    """Resolve relative date references to actual dates."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    lower = text.lower().strip()
    if lower == "today":
        return today
    elif lower == "tomorrow":
        return today + timedelta(days=1)
    elif lower == "yesterday":
        return today - timedelta(days=1)

    # Day names
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for i, day in enumerate(day_names):
        if lower == day:
            current_day = today.weekday()
            days_ahead = (i - current_day) % 7
            if days_ahead == 0:
                days_ahead = 7  # next week
            return today + timedelta(days=days_ahead)

    # Try parsing ISO-ish date
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(lower, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    return today


def _parse_time_range(text: str) -> tuple[int, int, int, int]:
    """Parse time ranges like '17-19', '9:30-11', '14:00-15:30'."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?", text)
    if match:
        start_h = int(match.group(1))
        start_m = int(match.group(2) or 0)
        end_h = int(match.group(3))
        end_m = int(match.group(4) or 0)
        return start_h, start_m, end_h, end_m
    return 9, 0, 10, 0  # default 1-hour event at 9am


def _parse_create_event(text: str) -> dict:
    """Parse event creation from natural language.

    Patterns:
    - 'add badminton for aadvika tomorrow 17-19'
    - 'create meeting with team on friday 10-11'
    - 'schedule dentist tomorrow 14:00-15:00'
    """
    lower = text.lower()

    # Extract the activity/title — first meaningful words after add/create/schedule
    title_match = re.match(
        r"(?:add|create|schedule|book|set up|plan)\s+(.+?)(?:\s+(?:for|with|on|at|tomorrow|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d))",
        lower,
    )
    title = title_match.group(1).strip() if title_match else lower.split(maxsplit=1)[-1].split(" for ")[0].split(" on ")[0].strip()

    # Extract member name (after 'for' or 'with')
    member_match = re.search(r"(?:for|with)\s+(\w+)", lower)
    member_name = member_match.group(1) if member_match else None

    # Extract date
    date_match = re.search(
        r"\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b",
        lower,
    )
    date_str = date_match.group(1) if date_match else "today"
    event_date = _resolve_date(date_str)

    # Extract time range
    start_h, start_m, end_h, end_m = _parse_time_range(text)
    start = event_date.replace(hour=start_h, minute=start_m)
    end = event_date.replace(hour=end_h, minute=end_m)

    data: dict = {
        "title": title.title(),
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
    if member_name:
        data["member_name"] = member_name.title()

    confirmation = f"Create '{data['title']}'"
    if member_name:
        confirmation += f" for {data['member_name']}"
    confirmation += f" on {event_date.strftime('%A %B %d')}, {start_h:02d}:{start_m:02d}-{end_h:02d}:{end_m:02d}"

    return {"intent": "create_event", "data": data, "confirmation_text": confirmation}


def _parse_query_events(text: str) -> dict:
    """Parse event queries.

    Patterns:
    - 'what is happening tomorrow'
    - 'show events for friday'
    - 'what's on today'
    """
    lower = text.lower()

    date_match = re.search(
        r"\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b",
        lower,
    )
    date_str = date_match.group(1) if date_match else "today"
    event_date = _resolve_date(date_str)

    start = event_date
    end = event_date + timedelta(days=1)

    return {
        "intent": "query_events",
        "data": {"start": start.isoformat(), "end": end.isoformat()},
        "confirmation_text": f"Show events for {event_date.strftime('%A %B %d')}",
    }


def _parse_delete_event(text: str) -> dict:
    """Parse event deletion.

    Patterns:
    - 'cancel badminton tomorrow'
    - 'delete meeting on friday'
    - 'remove dentist today'
    """
    lower = text.lower()

    title_match = re.match(
        r"(?:cancel|delete|remove)\s+(.+?)(?:\s+(?:on|tomorrow|today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d))",
        lower,
    )
    title = title_match.group(1).strip() if title_match else lower.split(maxsplit=1)[-1].strip()

    date_match = re.search(
        r"\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b",
        lower,
    )
    date_str = date_match.group(1) if date_match else "today"
    event_date = _resolve_date(date_str)

    return {
        "intent": "delete_event",
        "data": {
            "title": title.title(),
            "date": event_date.date().isoformat(),
        },
        "confirmation_text": f"Delete '{title.title()}' on {event_date.strftime('%A %B %d')}",
    }


def _parse_create_reminder(text: str) -> dict:
    """Parse reminder creation.

    Patterns:
    - 'remind me about dentist tomorrow at 8'
    - 'set reminder for meeting on friday'
    """
    lower = text.lower()

    subject_match = re.search(r"(?:about|for)\s+(.+?)(?:\s+(?:on|tomorrow|today|at|\d))", lower)
    subject = subject_match.group(1).strip() if subject_match else "event"

    date_match = re.search(
        r"\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b",
        lower,
    )
    date_str = date_match.group(1) if date_match else "today"
    remind_date = _resolve_date(date_str)

    time_match = re.search(r"at\s+(\d{1,2})(?::(\d{2}))?", lower)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        remind_date = remind_date.replace(hour=hour, minute=minute)
    else:
        remind_date = remind_date.replace(hour=8, minute=0)

    return {
        "intent": "create_reminder",
        "data": {
            "message": subject.title(),
            "remind_at": remind_date.isoformat(),
        },
        "confirmation_text": f"Set reminder for '{subject.title()}' at {remind_date.strftime('%A %B %d %H:%M')}",
    }


def interpret_text(text: str) -> dict:
    """Main dispatcher: classify intent and parse accordingly."""
    lower = text.lower().strip()

    # Shopping list patterns — add item
    add_shopping_match = re.match(
        r"(?:add\s+(.+?)\s+to\s+(?:shopping\s+)?list|we\s+need\s+(.+)|buy\s+(.+))",
        lower,
    )
    if add_shopping_match:
        item = (
            add_shopping_match.group(1)
            or add_shopping_match.group(2)
            or add_shopping_match.group(3)
        ).strip()
        return {
            "intent": "add_shopping_item",
            "data": {"name": item},
            "confirmation_text": f"Add '{item}' to the shopping list",
        }

    # Shopping list patterns — remove item
    remove_shopping_match = re.match(
        r"remove\s+(.+?)\s+from\s+(?:(?:the\s+)?(?:shopping\s+)?list)",
        lower,
    )
    if remove_shopping_match:
        item = remove_shopping_match.group(1).strip()
        return {
            "intent": "remove_shopping_item",
            "data": {"name": item},
            "confirmation_text": f"Remove '{item}' from the shopping list",
        }

    # Create event patterns
    if re.match(r"^(add|create|schedule|book|set up|plan)\s", lower):
        return _parse_create_event(text)

    # Query patterns
    if re.match(r"^(what|show|list|get|display|any)\s", lower) or "happening" in lower or "what's on" in lower:
        return _parse_query_events(text)

    # Delete/cancel patterns
    if re.match(r"^(cancel|delete|remove)\s", lower):
        return _parse_delete_event(text)

    # Update patterns
    if re.match(r"^(update|change|move|reschedule|edit)\s", lower):
        # For MVP, treat updates as a simplified intent
        return {
            "intent": "update_event",
            "data": {"raw_text": text},
            "confirmation_text": f"I understood you want to update something. Please use the app to make changes for now.",
        }

    # Reminder patterns
    if re.match(r"^(remind|set reminder|reminder)\s", lower):
        return _parse_create_reminder(text)

    # Fallback: try to guess
    if any(word in lower for word in ["remind", "reminder"]):
        return _parse_create_reminder(text)

    # Default: treat as query
    return _parse_query_events(text)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post("/interpret", response_model=VoiceResult)
async def voice_interpret(
    slug: str,
    body: VoiceInput,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Accept voice text and return parsed intent with data.

    Intents: create_event, query_events, update_event, delete_event, create_reminder.
    Uses simple keyword/regex parsing (no external AI).
    """
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = interpret_text(body.text)
    return VoiceResult(**result)
