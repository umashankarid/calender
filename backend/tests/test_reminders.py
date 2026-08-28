"""Tests for reminder endpoints: /api/workspaces/{slug}/reminders."""

import uuid
from datetime import datetime, timedelta, timezone

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

NOW = datetime(2026, 8, 28, 10, 0, 0, tzinfo=timezone.utc)


async def setup_workspace_with_user(
    db: AsyncSession,
    *,
    email: str = "owner@example.com",
    slug: str = "ws-test",
    role: str = "owner",
) -> tuple[User, Workspace, WorkspaceUser, dict]:
    """Insert user, workspace, workspace_user. Return (user, workspace, member, headers)."""
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


async def create_event_for_workspace(
    client: AsyncClient,
    slug: str,
    headers: dict,
    title: str = "Test Event",
) -> str:
    """Create a minimal event and return its id."""
    resp = await client.post(
        f"{BASE}/{slug}/events/",
        json={"title": title, "start": NOW.isoformat()},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def reminder_payload(
    event_id: str,
    remind_at: datetime | None = None,
    message: str | None = "Don't forget!",
    **overrides,
) -> dict:
    """Build a JSON-serialisable reminder creation payload."""
    data: dict = {
        "event_id": event_id,
        "remind_at": (remind_at or (NOW + timedelta(hours=1))).isoformat(),
    }
    if message is not None:
        data["message"] = message
    data.update(overrides)
    return data


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_reminder(client: AsyncClient, db: AsyncSession):
    """Create a reminder attached to an event."""
    _, ws, member, headers = await setup_workspace_with_user(db)
    event_id = await create_event_for_workspace(client, ws.slug, headers)

    remind_at = NOW + timedelta(hours=2)
    payload = reminder_payload(event_id, remind_at=remind_at, message="Reminder!")
    resp = await client.post(
        f"{BASE}/{ws.slug}/reminders/",
        json=payload,
        headers=headers,
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["event_id"] == event_id
    assert body["message"] == "Reminder!"
    assert body["status"] == "pending"
    assert "id" in body


async def test_list_reminders(client: AsyncClient, db: AsyncSession):
    """List all reminders, filter by event_id, filter by status."""
    _, ws, member, headers = await setup_workspace_with_user(db)

    event_a_id = await create_event_for_workspace(client, ws.slug, headers, "Event A")
    event_b_id = await create_event_for_workspace(client, ws.slug, headers, "Event B")

    # Create reminders for both events
    await client.post(
        f"{BASE}/{ws.slug}/reminders/",
        json=reminder_payload(event_a_id, message="R-A"),
        headers=headers,
    )
    resp_b = await client.post(
        f"{BASE}/{ws.slug}/reminders/",
        json=reminder_payload(event_b_id, message="R-B"),
        headers=headers,
    )
    reminder_b_id = resp_b.json()["id"]

    # List all → 2 reminders
    resp = await client.get(f"{BASE}/{ws.slug}/reminders/", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Filter by event_id → 1 reminder
    resp = await client.get(
        f"{BASE}/{ws.slug}/reminders/",
        params={"event_id": event_a_id},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["event_id"] == event_a_id

    # Update reminder B to "sent" so we can filter by status
    await client.put(
        f"{BASE}/{ws.slug}/reminders/{reminder_b_id}",
        json={"status": "sent"},
        headers=headers,
    )

    # Filter by status "pending" → only R-A
    resp = await client.get(
        f"{BASE}/{ws.slug}/reminders/",
        params={"status": "pending"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["message"] == "R-A"

    # Filter by status "sent" → only R-B
    resp = await client.get(
        f"{BASE}/{ws.slug}/reminders/",
        params={"status": "sent"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["message"] == "R-B"


async def test_update_reminder(client: AsyncClient, db: AsyncSession):
    """Update remind_at and status."""
    _, ws, _, headers = await setup_workspace_with_user(db)
    event_id = await create_event_for_workspace(client, ws.slug, headers)

    create_resp = await client.post(
        f"{BASE}/{ws.slug}/reminders/",
        json=reminder_payload(event_id),
        headers=headers,
    )
    reminder_id = create_resp.json()["id"]

    new_remind_at = (NOW + timedelta(days=1)).isoformat()
    resp = await client.put(
        f"{BASE}/{ws.slug}/reminders/{reminder_id}",
        json={"remind_at": new_remind_at, "status": "sent"},
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "sent"
    assert body["id"] == reminder_id


async def test_delete_reminder(client: AsyncClient, db: AsyncSession):
    """Delete a reminder."""
    _, ws, _, headers = await setup_workspace_with_user(db)
    event_id = await create_event_for_workspace(client, ws.slug, headers)

    create_resp = await client.post(
        f"{BASE}/{ws.slug}/reminders/",
        json=reminder_payload(event_id),
        headers=headers,
    )
    reminder_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"{BASE}/{ws.slug}/reminders/{reminder_id}", headers=headers
    )
    assert del_resp.status_code == 204

    # Verify gone — list should be empty
    list_resp = await client.get(f"{BASE}/{ws.slug}/reminders/", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0


async def test_reminder_invalid_event(client: AsyncClient, db: AsyncSession):
    """Reminder for non-existent event gets 404."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    fake_event_id = str(uuid.uuid4())
    payload = reminder_payload(fake_event_id)
    resp = await client.post(
        f"{BASE}/{ws.slug}/reminders/",
        json=payload,
        headers=headers,
    )

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
