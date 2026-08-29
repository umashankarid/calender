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
    """Resolve relative date references to actual dates. Supports English and Swedish."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    lower = text.lower().strip()

    # English relative
    if lower in ("today", "idag"):
        return today
    if lower in ("tomorrow", "imorgon", "i morgon"):
        return today + timedelta(days=1)
    if lower in ("yesterday", "igår", "i går"):
        return today - timedelta(days=1)

    # English day names
    day_names_en = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_names_sv = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]

    for i, (en, sv) in enumerate(zip(day_names_en, day_names_sv)):
        if lower == en or lower == sv:
            current_day = today.weekday()
            days_ahead = (i - current_day) % 7
            if days_ahead == 0:
                days_ahead = 7
            return today + timedelta(days=days_ahead)

    # Swedish month names → number
    sv_months = {
        "jan": 1, "januari": 1, "feb": 2, "februari": 2, "mar": 3, "mars": 3,
        "apr": 4, "april": 4, "maj": 5, "jun": 6, "juni": 6, "jul": 7, "juli": 7,
        "aug": 8, "augusti": 8, "sep": 9, "september": 9, "okt": 10, "oktober": 10,
        "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    en_months = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
        "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
        "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    all_months = {**sv_months, **en_months}

    # Try "30 aug", "aug 30", "30 augusti", "30/8", "30-8", "2026-08-30"
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m", "%d-%m"):
        try:
            parsed = datetime.strptime(lower, fmt)
            if parsed.year == 1900:  # no year in format
                parsed = parsed.replace(year=today.year)
                if parsed < today:
                    parsed = parsed.replace(year=today.year + 1)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # "30 aug" / "30 augusti" / "aug 30" / "30 august"
    date_month_match = re.search(r"(\d{1,2})\s+(\w+)", lower)
    if date_month_match:
        day_num = int(date_month_match.group(1))
        month_name = date_month_match.group(2).lower()
        if month_name in all_months and 1 <= day_num <= 31:
            month_num = all_months[month_name]
            year = today.year
            candidate = datetime(year, month_num, day_num, tzinfo=timezone.utc)
            if candidate < today:
                candidate = candidate.replace(year=year + 1)
            return candidate

    month_date_match = re.search(r"(\w+)\s+(\d{1,2})", lower)
    if month_date_match:
        month_name = month_date_match.group(1).lower()
        day_num = int(month_date_match.group(2))
        if month_name in all_months and 1 <= day_num <= 31:
            month_num = all_months[month_name]
            year = today.year
            candidate = datetime(year, month_num, day_num, tzinfo=timezone.utc)
            if candidate < today:
                candidate = candidate.replace(year=year + 1)
            return candidate

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
    """Parse event creation from natural language or SMS text.

    Handles:
    - 'add badminton for aadvika tomorrow 17-19'
    - SMS: 'Din tid hos Tandläkare 30 aug kl 14:00'
    - SMS: 'Appointment confirmed: Dr Smith, August 30 at 2:00 PM'
    - 'Doctor visit on friday at 10'
    """
    lower = text.lower()

    # ── Extract date from anywhere in the text ──────────────────────
    sv_months = {
        "jan": 1, "januari": 1, "feb": 2, "februari": 2, "mar": 3, "mars": 3,
        "apr": 4, "april": 4, "maj": 5, "jun": 6, "juni": 6, "jul": 7, "juli": 7,
        "aug": 8, "augusti": 8, "sep": 9, "september": 9, "okt": 10, "oktober": 10,
        "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    en_months = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
        "aug": 8, "august": 8, "sep": 9, "september": 9, "oct": 10, "october": 10,
        "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    all_months = {**sv_months, **en_months}
    month_pattern = "|".join(all_months.keys())

    event_date = None

    # Try "30 aug", "30 augusti", "aug 30", "august 30", "30/8", "2026-08-30"
    date_month = re.search(rf"(\d{{1,2}})\s+({month_pattern})\b", lower)
    month_date = re.search(rf"\b({month_pattern})\s+(\d{{1,2}})\b", lower)
    iso_date = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", lower)
    slash_date = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", lower)

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    if iso_date:
        event_date = datetime(int(iso_date.group(1)), int(iso_date.group(2)), int(iso_date.group(3)), tzinfo=timezone.utc)
    elif date_month:
        day = int(date_month.group(1))
        month = all_months[date_month.group(2)]
        year = today.year
        event_date = datetime(year, month, day, tzinfo=timezone.utc)
        if event_date < today:
            event_date = event_date.replace(year=year + 1)
    elif month_date:
        month = all_months[month_date.group(1)]
        day = int(month_date.group(2))
        year = today.year
        event_date = datetime(year, month, day, tzinfo=timezone.utc)
        if event_date < today:
            event_date = event_date.replace(year=year + 1)
    elif slash_date:
        day = int(slash_date.group(1))
        month = int(slash_date.group(2))
        year = int(slash_date.group(3)) if slash_date.group(3) else today.year
        if year < 100:
            year += 2000
        event_date = datetime(year, month, day, tzinfo=timezone.utc)
    else:
        # Try relative dates (English + Swedish)
        rel_match = re.search(
            r"\b(today|tomorrow|idag|imorgon|i morgon|igår|"
            r"monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
            r"måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\b",
            lower,
        )
        if rel_match:
            event_date = _resolve_date(rel_match.group(1))
        else:
            event_date = today

    # ── Extract time ────────────────────────────────────────────────
    # "kl 14:00", "kl. 14", "at 14:00", "at 2:00 PM", "14:00-15:30", "kl 14-15"
    time_match = re.search(
        r"(?:kl\.?\s*|at\s+)(\d{1,2})(?::(\d{2}))?\s*(?:(am|pm|AM|PM))?"
        r"(?:\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(?:(am|pm|AM|PM))?)?",
        text,
    )
    if not time_match:
        # Try standalone time pattern "14:00" or "14.00"
        time_match = re.search(
            r"\b(\d{1,2})(?:[:.](\d{2}))\s*(?:(am|pm|AM|PM))?"
            r"(?:\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:(am|pm|AM|PM))?)?",
            text,
        )

    start_h, start_m, end_h, end_m = 9, 0, 10, 0
    if time_match:
        start_h = int(time_match.group(1))
        start_m = int(time_match.group(2) or 0)
        am_pm = (time_match.group(3) or "").lower()
        if am_pm == "pm" and start_h < 12:
            start_h += 12
        if am_pm == "am" and start_h == 12:
            start_h = 0

        if time_match.group(4):
            end_h = int(time_match.group(4))
            end_m = int(time_match.group(5) or 0)
            end_pm = (time_match.group(6) or "").lower()
            if end_pm == "pm" and end_h < 12:
                end_h += 12
        else:
            end_h = start_h + 1
            end_m = start_m

    start = event_date.replace(hour=start_h, minute=start_m)
    end = event_date.replace(hour=end_h, minute=end_m)

    # ── Extract title ───────────────────────────────────────────────
    # For command-style: "add badminton for aadvika tomorrow"
    title_match = re.match(
        r"(?:add|create|schedule|book|set up|plan|lägg till|skapa|boka)\s+(.+?)(?:\s+(?:for|för|with|med|on|at|tomorrow|today|imorgon|idag|"
        + month_pattern + r"|\d{1,2}/\d|\d{4}-\d{2}))",
        lower,
    )
    if title_match:
        title = title_match.group(1).strip()
    else:
        # For SMS: use the first meaningful sentence/phrase as title
        # Remove common SMS prefixes
        cleaned = re.sub(
            r"^(din tid|your appointment|bokningsbekräftelse|reminder|påminnelse|"
            r"confirmation|bekräftelse)[:\s]*",
            "", lower,
        ).strip()
        # Take first chunk up to a date or time reference
        title_cut = re.split(
            rf"\b(?:den\s+)?\d{{1,2}}\s+(?:{month_pattern})|\b\d{{4}}-\d{{2}}-\d{{2}}\b|"
            r"\bkl\.?\s*\d|\bat\s+\d|\d{1,2}:\d{2}",
            cleaned,
        )[0].strip()
        title = title_cut if len(title_cut) > 2 else cleaned[:60]
        # Clean up trailing prepositions
        title = re.sub(r"\s+(den|on|at|hos|på|i|kl)\s*$", "", title).strip()

    # ── Extract member name ─────────────────────────────────────────
    member_match = re.search(r"(?:for|för|with|med)\s+(\w+)", lower)
    member_name = member_match.group(1) if member_match else None

    # ── Extract location ────────────────────────────────────────────
    loc_match = re.search(r"(?:at|på|hos|i|location:?|plats:?)\s+([A-ZÅÄÖ][\w\s,]+?)(?:\.|,\s|\n|$)", text)
    location = loc_match.group(1).strip() if loc_match else None

    # ── Build response ──────────────────────────────────────────────
    data: dict = {
        "title": title.title() if title else "Appointment",
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
    if member_name:
        data["member_name"] = member_name.title()
    if location:
        data["location"] = location

    confirmation = f"Create '{data['title']}'"
    if member_name:
        confirmation += f" for {data['member_name']}"
    confirmation += f" on {event_date.strftime('%A %B %d')}, {start_h:02d}:{start_m:02d}-{end_h:02d}:{end_m:02d}"
    if location:
        confirmation += f" at {location}"

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

    # Create event patterns (English + Swedish)
    if re.match(r"^(add|create|schedule|book|set up|plan|lägg till|skapa|boka)\s", lower):
        return _parse_create_event(text)

    # Query patterns (English + Swedish)
    if re.match(r"^(what|show|list|get|display|any|visa|vad)\s", lower) or "happening" in lower or "what's on" in lower or "händer" in lower:
        return _parse_query_events(text)

    # Delete/cancel patterns (English + Swedish)
    if re.match(r"^(cancel|delete|remove|avboka|ta bort|ställ in)\s", lower):
        return _parse_delete_event(text)

    # Update patterns (English + Swedish)
    if re.match(r"^(update|change|move|reschedule|edit|ändra|flytta)\s", lower):
        return {
            "intent": "update_event",
            "data": {"raw_text": text},
            "confirmation_text": f"I understood you want to update something. Please use the app to make changes for now.",
        }

    # Reminder patterns (English + Swedish)
    if re.match(r"^(remind|set reminder|reminder|påminn|påminnelse)\s", lower):
        return _parse_create_reminder(text)

    # Fallback: try to guess
    if any(word in lower for word in ["remind", "reminder", "påminn", "påminnelse"]):
        return _parse_create_reminder(text)

    # SMS/shared text fallback: if it contains a date + time, treat as event creation
    sv_months = "jan|januari|feb|februari|mar|mars|apr|april|maj|jun|juni|jul|juli|aug|augusti|sep|september|okt|oktober|nov|november|dec|december"
    en_months = "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december"
    has_date = bool(re.search(rf"\b\d{{1,2}}\s+(?:{sv_months}|{en_months})\b", lower)) or \
               bool(re.search(r"\b\d{4}-\d{2}-\d{2}\b", lower)) or \
               bool(re.search(r"\b\d{1,2}/\d{1,2}\b", lower))
    has_time = bool(re.search(r"(?:kl\.?\s*\d|\bat\s+\d|\d{1,2}:\d{2})", lower))

    if has_date or has_time:
        return _parse_create_event(text)

    # Default: treat as event creation with the text as title
    return _parse_create_event(text)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post("/interpret/", response_model=VoiceResult)
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
