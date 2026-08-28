"""Tests for calendar endpoints: /api/workspaces/{slug}/calendars."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from tests.conftest import auth_headers

BASE = "/api/workspaces"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def setup_workspace_with_user(
    db: AsyncSession,
    *,
    email: str = "owner@example.com",
    slug: str = "ws-test",
    role: str = "owner",
) -> tuple[User, Workspace, WorkspaceUser, dict]:
    """Insert a user, workspace, and workspace_user. Return (user, workspace, member, headers)."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        name="Owner",
        password_hash=hash_password("pass"),
    )
    db.add(user)
    await db.flush()

    workspace = Workspace(id=uuid.uuid4(), name="WS", slug=slug)
    db.add(workspace)
    await db.flush()

    member = WorkspaceUser(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        role=role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(user)
    await db.refresh(workspace)
    await db.refresh(member)

    headers = auth_headers(user.id, workspace.id)
    return user, workspace, member, headers


async def create_calendar(
    client: AsyncClient,
    slug: str,
    headers: dict,
    name: str = "My Calendar",
    color: str = "#FF0000",
) -> dict:
    """Helper to POST a calendar and return the response."""
    resp = await client.post(
        f"{BASE}/{slug}/calendars/",
        json={"name": name, "color": color},
        headers=headers,
    )
    return resp


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_calendar(client: AsyncClient, db: AsyncSession):
    """Create a calendar with name + color, verify 201 and response fields."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    resp = await create_calendar(client, ws.slug, headers, "Work", "#00FF00")

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Work"
    assert body["color"] == "#00FF00"
    assert body["is_default"] is False
    assert "id" in body
    assert body["workspace_id"] == str(ws.id)


async def test_list_calendars(client: AsyncClient, db: AsyncSession):
    """Create multiple calendars, list all."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    await create_calendar(client, ws.slug, headers, "Cal A")
    await create_calendar(client, ws.slug, headers, "Cal B")
    await create_calendar(client, ws.slug, headers, "Cal C")

    resp = await client.get(f"{BASE}/{ws.slug}/calendars/", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    names = {c["name"] for c in body}
    assert names == {"Cal A", "Cal B", "Cal C"}


async def test_update_calendar(client: AsyncClient, db: AsyncSession):
    """Update a calendar's name."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    create_resp = await create_calendar(client, ws.slug, headers, "Old Name")
    cal_id = create_resp.json()["id"]

    resp = await client.put(
        f"{BASE}/{ws.slug}/calendars/{cal_id}",
        json={"name": "New Name"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New Name"
    assert body["id"] == cal_id


async def test_delete_calendar(client: AsyncClient, db: AsyncSession):
    """Delete a calendar and verify it's gone."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    create_resp = await create_calendar(client, ws.slug, headers, "Temp")
    cal_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"{BASE}/{ws.slug}/calendars/{cal_id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verify the calendar no longer appears in the list
    list_resp = await client.get(f"{BASE}/{ws.slug}/calendars/", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0


async def test_viewer_cannot_create_calendar(client: AsyncClient, db: AsyncSession):
    """A viewer-role user gets 403 when trying to create a calendar."""
    _, ws, _, headers = await setup_workspace_with_user(
        db, email="viewer@example.com", slug="viewer-ws", role="viewer"
    )

    resp = await create_calendar(client, ws.slug, headers, "Forbidden")
    assert resp.status_code == 403


async def test_calendar_workspace_isolation(client: AsyncClient, db: AsyncSession):
    """Calendars from workspace A are not visible in workspace B."""
    # Setup workspace A
    _, ws_a, _, headers_a = await setup_workspace_with_user(
        db, email="a@example.com", slug="ws-a"
    )
    # Setup workspace B (different user + workspace)
    _, ws_b, _, headers_b = await setup_workspace_with_user(
        db, email="b@example.com", slug="ws-b"
    )

    # Create a calendar in workspace A
    create_resp = await create_calendar(client, ws_a.slug, headers_a, "Private Cal")
    assert create_resp.status_code == 201

    # Workspace B should not see it
    list_resp = await client.get(f"{BASE}/{ws_b.slug}/calendars/", headers=headers_b)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0
