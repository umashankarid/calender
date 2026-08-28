"""Google Calendar sync endpoints.

Handles OAuth2 connect/callback, calendar listing, manual sync, and disconnect.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.event import Event
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.services.google_calendar import (
    exchange_code,
    get_auth_url,
    list_calendars,
    refresh_access_token,
    sync_google_events,
)

router = APIRouter(
    prefix="/workspaces/{slug}/google",
    tags=["google-calendar"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_workspace(slug: str, db: AsyncSession) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.slug == slug))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


async def _get_member(
    workspace_id: uuid.UUID, user_id: str, db: AsyncSession
) -> WorkspaceUser:
    result = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == (uuid.UUID(user_id) if isinstance(user_id, str) else user_id),
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace",
        )
    return member


def _check_role(member: WorkspaceUser, min_role: str) -> None:
    min_level = ROLE_HIERARCHY.get(min_role, 0)
    user_level = ROLE_HIERARCHY.get(member.role, -1)
    if user_level < min_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires at least '{min_role}' role",
        )


def _get_connection_data(workspace: Workspace) -> dict | None:
    """Read Google connection data from workspace.settings JSON."""
    s = workspace.settings or {}
    return s.get("google_connection")


def _set_connection_data(workspace: Workspace, data: dict | None) -> None:
    """Write Google connection data to workspace.settings JSON."""
    if workspace.settings is None:
        workspace.settings = {}
    if data is None:
        workspace.settings.pop("google_connection", None)
    else:
        workspace.settings = {**workspace.settings, "google_connection": data}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/connect/")
async def google_connect(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Return the Google OAuth2 authorization URL."""
    workspace = await _get_workspace(slug, db)
    await _get_member(workspace.id, payload["sub"], db)

    state = json.dumps({"workspace_id": str(workspace.id), "user_id": payload["sub"]})
    auth_url = get_auth_url(state)
    return {"auth_url": auth_url}


@router.get("/callback/")
async def google_callback(
    slug: str,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Google redirects here after user grants permission.

    Exchanges the authorization code for tokens and stores them on the
    workspace's settings JSON.
    """
    workspace = await _get_workspace(slug, db)

    # Decode state
    try:
        state_data = json.loads(state)
        ws_id = state_data["workspace_id"]
        user_id = state_data["user_id"]
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state")

    if str(workspace.id) != ws_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace mismatch")

    # Exchange code for tokens
    tokens = exchange_code(code)

    connection_data = {
        "user_id": user_id,
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_at": tokens["expires_at"],
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    _set_connection_data(workspace, connection_data)
    await db.flush()

    return {"message": "Google Calendar connected successfully"}


@router.get("/calendars/")
async def google_calendars(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List the user's Google calendars."""
    workspace = await _get_workspace(slug, db)
    await _get_member(workspace.id, payload["sub"], db)

    conn = _get_connection_data(workspace)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not connected",
        )

    access_token = conn["access_token"]

    # Refresh if expired
    expires_at_str = conn.get("expires_at")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            refreshed = refresh_access_token(conn["refresh_token"])
            access_token = refreshed["access_token"]
            conn["access_token"] = access_token
            conn["expires_at"] = refreshed["expires_at"]
            _set_connection_data(workspace, conn)
            await db.flush()

    calendars = list_calendars(access_token)
    return calendars


@router.post("/sync/")
async def google_sync(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a manual sync of all connected Google calendars.

    Requires editor+ role.
    """
    workspace = await _get_workspace(slug, db)
    member = await _get_member(workspace.id, payload["sub"], db)
    _check_role(member, "editor")

    conn = _get_connection_data(workspace)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not connected",
        )

    access_token = conn["access_token"]

    # Refresh if expired
    expires_at_str = conn.get("expires_at")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            refreshed = refresh_access_token(conn["refresh_token"])
            access_token = refreshed["access_token"]
            conn["access_token"] = access_token
            conn["expires_at"] = refreshed["expires_at"]
            _set_connection_data(workspace, conn)
            await db.flush()

    # Sync from primary calendar; extend in the future to handle multiple calendars
    time_min = datetime.now(timezone.utc) - timedelta(days=30)
    time_max = datetime.now(timezone.utc) + timedelta(days=90)

    total = await sync_google_events(
        db=db,
        workspace_id=workspace.id,
        calendar_connection_id=workspace.id,  # placeholder
        access_token=access_token,
        google_calendar_id="primary",
        time_min=time_min,
        time_max=time_max,
    )

    return {"synced_count": total}


@router.delete("/disconnect/")
async def google_disconnect(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Remove Google Calendar connection and optionally remove synced events.

    Requires admin+ role.
    """
    workspace = await _get_workspace(slug, db)
    member = await _get_member(workspace.id, payload["sub"], db)
    _check_role(member, "admin")

    conn = _get_connection_data(workspace)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not connected",
        )

    # Remove connection data
    _set_connection_data(workspace, None)

    # Remove Google-synced events
    await db.execute(
        delete(Event).where(
            Event.workspace_id == workspace.id,
            Event.source == "google",
        )
    )
    await db.flush()

    return {"message": "Google Calendar disconnected and synced events removed"}
