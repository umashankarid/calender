"""Google Calendar integration service.

Provides OAuth2 flow helpers and event synchronisation with Google Calendar.
"""

import uuid
from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.models.event import Event

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
]

_CLIENT_CONFIG = {
    "web": {
        "client_id": "",
        "client_secret": "",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": [],
    }
}


def _get_client_config() -> dict:
    """Build the client config dict from current settings."""
    cfg = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    return cfg


# ---------------------------------------------------------------------------
# OAuth2 helpers
# ---------------------------------------------------------------------------


def get_auth_url(state: str) -> str:
    """Generate Google OAuth2 authorization URL.

    *state* should encode workspace_id + user_id so the callback can
    associate the tokens with the correct workspace/user.
    """
    flow = Flow.from_client_config(_get_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url


def exchange_code(code: str) -> dict:
    """Exchange an authorization code for tokens.

    Returns ``{access_token, refresh_token, expires_at}``.
    """
    flow = Flow.from_client_config(_get_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.google_redirect_uri
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "expires_at": creds.expiry.isoformat() if creds.expiry else None,
    }


def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired access token.

    Returns ``{access_token, expires_at}``.
    """
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    from google.auth.transport.requests import Request

    creds.refresh(Request())
    return {
        "access_token": creds.token,
        "expires_at": creds.expiry.isoformat() if creds.expiry else None,
    }


# ---------------------------------------------------------------------------
# Calendar & Event helpers
# ---------------------------------------------------------------------------


def _build_service(access_token: str):
    """Build a Google Calendar API service from an access token."""
    creds = Credentials(token=access_token)
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def list_calendars(access_token: str) -> list[dict]:
    """List user's Google calendars.

    Returns ``[{id, summary, backgroundColor}]``.
    """
    service = _build_service(access_token)
    result = service.calendarList().list().execute()
    calendars: list[dict] = []
    for item in result.get("items", []):
        calendars.append(
            {
                "id": item["id"],
                "summary": item.get("summary", ""),
                "backgroundColor": item.get("backgroundColor", "#4285F4"),
            }
        )
    return calendars


def fetch_events(
    access_token: str,
    calendar_id: str,
    time_min: datetime,
    time_max: datetime,
) -> list[dict]:
    """Fetch events from a Google calendar.

    Returns ``[{id, summary, start, end, location, description}]``.
    Handles both ``dateTime`` and ``date`` (all-day) events.
    """
    service = _build_service(access_token)
    events_result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=time_min.isoformat(),
            timeMax=time_max.isoformat(),
            singleEvents=True,
            orderBy="startTime",
            maxResults=2500,
        )
        .execute()
    )

    events: list[dict] = []
    for item in events_result.get("items", []):
        start_raw = item.get("start", {})
        end_raw = item.get("end", {})

        # dateTime → timed event; date → all-day event
        if "dateTime" in start_raw:
            start = datetime.fromisoformat(start_raw["dateTime"])
            end = datetime.fromisoformat(end_raw["dateTime"]) if "dateTime" in end_raw else start
            all_day = False
        elif "date" in start_raw:
            start = datetime.strptime(start_raw["date"], "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
            end_str = end_raw.get("date", start_raw["date"])
            end = datetime.strptime(end_str, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
            all_day = True
        else:
            continue

        events.append(
            {
                "id": item["id"],
                "summary": item.get("summary", "(No title)"),
                "start": start,
                "end": end,
                "location": item.get("location"),
                "description": item.get("description"),
                "all_day": all_day,
            }
        )
    return events


# ---------------------------------------------------------------------------
# Full sync
# ---------------------------------------------------------------------------


async def sync_google_events(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    calendar_connection_id: uuid.UUID,
    access_token: str,
    google_calendar_id: str,
    time_min: datetime,
    time_max: datetime,
) -> int:
    """Fetch events from Google and upsert into the Events table.

    Matches by ``external_id``. Sets ``source='google'``.
    Returns the count of synced (inserted + updated) events.
    Removes events that no longer exist on Google's side.
    """
    google_events = fetch_events(access_token, google_calendar_id, time_min, time_max)
    google_ids = {e["id"] for e in google_events}

    # Fetch existing Google-sourced events for this workspace
    result = await db.execute(
        select(Event).where(
            Event.workspace_id == workspace_id,
            Event.source == "google",
            Event.external_id.isnot(None),
        )
    )
    existing_events = {e.external_id: e for e in result.scalars().all()}

    synced_count = 0

    for ge in google_events:
        ext_id = ge["id"]
        if ext_id in existing_events:
            # Update existing event
            ev = existing_events[ext_id]
            ev.title = ge["summary"]
            ev.start = ge["start"]
            ev.end = ge["end"]
            ev.all_day = ge.get("all_day", False)
            ev.location = ge.get("location")
            ev.notes = ge.get("description")
            ev.updated_at = datetime.now(timezone.utc)
        else:
            # Insert new event
            ev = Event(
                workspace_id=workspace_id,
                title=ge["summary"],
                start=ge["start"],
                end=ge["end"],
                all_day=ge.get("all_day", False),
                location=ge.get("location"),
                notes=ge.get("description"),
                source="google",
                external_id=ext_id,
            )
            db.add(ev)
        synced_count += 1

    # Remove events that are no longer on Google
    stale_ids = set(existing_events.keys()) - google_ids
    if stale_ids:
        await db.execute(
            delete(Event).where(
                Event.workspace_id == workspace_id,
                Event.source == "google",
                Event.external_id.in_(stale_ids),
            )
        )

    await db.flush()
    return synced_count
