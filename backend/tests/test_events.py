"""Tests for event endpoints: /api/workspaces/{slug}/events."""

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


async def add_workspace_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    *,
    email: str = "member@example.com",
    role: str = "editor",
) -> tuple[User, WorkspaceUser]:
    """Add another user as a member of the workspace."""
    user = User(
        id=uuid.uuid4(),
        email=email,
        name="Member",
        password_hash=hash_password("pass"),
    )
    db.add(user)
    await db.flush()

    member = WorkspaceUser(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        user_id=user.id,
        role=role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(user)
    await db.refresh(member)
    return user, member


def event_payload(
    title: str = "Team Meeting",
    start: datetime | None = None,
    end: datetime | None = None,
    **overrides,
) -> dict:
    """Build a JSON-serialisable event creation payload."""
    data: dict = {
        "title": title,
        "start": (start or NOW).isoformat(),
    }
    if end is not None:
        data["end"] = end.isoformat()
    data.update(overrides)
    return data


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_event(client: AsyncClient, db: AsyncSession):
    """Create an event with title, start, end — verify 201 and body."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    payload = event_payload(
        title="Standup",
        start=NOW,
        end=NOW + timedelta(hours=1),
    )
    resp = await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Standup"
    assert body["all_day"] is False
    assert body["workspace_id"] == str(ws.id)
    assert "id" in body
    assert "members" in body


async def test_create_event_with_members(client: AsyncClient, db: AsyncSession):
    """Create event and assign member_ids."""
    _, ws, owner_member, headers = await setup_workspace_with_user(db)
    _, extra_member = await add_workspace_member(db, ws.id, email="m1@example.com")

    payload = event_payload(
        title="With Members",
        member_ids=[str(owner_member.id), str(extra_member.id)],
    )
    resp = await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    assert resp.status_code == 201
    body = resp.json()
    assert len(body["members"]) == 2
    member_ids = {m["id"] for m in body["members"]}
    assert str(owner_member.id) in member_ids
    assert str(extra_member.id) in member_ids


async def test_create_event_all_day(client: AsyncClient, db: AsyncSession):
    """Create all-day event."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    payload = event_payload(title="Holiday", all_day=True)
    resp = await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    assert resp.status_code == 201
    assert resp.json()["all_day"] is True


async def test_create_event_with_recurrence(client: AsyncClient, db: AsyncSession):
    """Create recurring weekly event with 3 occurrences."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    payload = event_payload(title="Recurring", recurrence="weekly", repeat_count=3)
    resp = await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    assert resp.status_code == 201
    assert resp.json()["recurrence"] == "weekly"

    # Verify 3 events were created
    list_resp = await client.get(f"{BASE}/{ws.slug}/events/", headers=headers)
    recurring = [e for e in list_resp.json() if e["title"] == "Recurring"]
    assert len(recurring) == 3


async def test_list_events(client: AsyncClient, db: AsyncSession):
    """Create multiple events, list all."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    for i in range(3):
        payload = event_payload(title=f"Event {i}", start=NOW + timedelta(hours=i))
        await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    resp = await client.get(f"{BASE}/{ws.slug}/events/", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3


async def test_list_events_date_filter(client: AsyncClient, db: AsyncSession):
    """Filter events by start/end query params."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    # Create events at different times
    t1 = datetime(2026, 9, 1, 9, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 5, 9, 0, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 9, 10, 9, 0, 0, tzinfo=timezone.utc)

    for t, title in [(t1, "Early"), (t2, "Mid"), (t3, "Late")]:
        payload = event_payload(title=title, start=t)
        await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    # Filter: start >= Sep 3, end <= Sep 7  → only "Mid"
    filter_start = datetime(2026, 9, 3, 0, 0, 0, tzinfo=timezone.utc).isoformat()
    filter_end = datetime(2026, 9, 7, 0, 0, 0, tzinfo=timezone.utc).isoformat()

    resp = await client.get(
        f"{BASE}/{ws.slug}/events/",
        params={"start": filter_start, "end": filter_end},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["title"] == "Mid"


async def test_list_events_member_filter(client: AsyncClient, db: AsyncSession):
    """Filter events by member_id."""
    _, ws, owner_member, headers = await setup_workspace_with_user(db)
    _, extra_member = await add_workspace_member(db, ws.id, email="filter@example.com")

    # Event A has owner_member only
    payload_a = event_payload(title="A", member_ids=[str(owner_member.id)])
    await client.post(f"{BASE}/{ws.slug}/events/", json=payload_a, headers=headers)

    # Event B has extra_member only
    payload_b = event_payload(
        title="B",
        start=NOW + timedelta(hours=1),
        member_ids=[str(extra_member.id)],
    )
    await client.post(f"{BASE}/{ws.slug}/events/", json=payload_b, headers=headers)

    # Filter by extra_member → only Event B
    resp = await client.get(
        f"{BASE}/{ws.slug}/events/",
        params={"member_id": str(extra_member.id)},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["title"] == "B"


async def test_get_event(client: AsyncClient, db: AsyncSession):
    """Get a single event by ID, including members."""
    _, ws, owner_member, headers = await setup_workspace_with_user(db)

    payload = event_payload(title="Solo", member_ids=[str(owner_member.id)])
    create_resp = await client.post(
        f"{BASE}/{ws.slug}/events/", json=payload, headers=headers
    )
    assert create_resp.status_code == 201
    event_id = create_resp.json()["id"]

    resp = await client.get(f"{BASE}/{ws.slug}/events/{event_id}", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == event_id
    assert body["title"] == "Solo"
    assert len(body["members"]) == 1


async def test_update_event(client: AsyncClient, db: AsyncSession):
    """Update title and time."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    create_resp = await client.post(
        f"{BASE}/{ws.slug}/events/",
        json=event_payload(title="Original"),
        headers=headers,
    )
    assert create_resp.status_code == 201
    event_id = create_resp.json()["id"]

    new_start = (NOW + timedelta(days=1)).isoformat()
    resp = await client.put(
        f"{BASE}/{ws.slug}/events/{event_id}",
        json={"title": "Updated", "start": new_start},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Updated"


async def test_update_event_members(client: AsyncClient, db: AsyncSession):
    """Change member assignments on an event."""
    _, ws, owner_member, headers = await setup_workspace_with_user(db)
    _, member_a = await add_workspace_member(db, ws.id, email="a@example.com")
    _, member_b = await add_workspace_member(db, ws.id, email="b@example.com")

    # Create with member_a
    payload = event_payload(title="MemberSwap", member_ids=[str(member_a.id)])
    create_resp = await client.post(
        f"{BASE}/{ws.slug}/events/", json=payload, headers=headers
    )
    assert create_resp.status_code == 201
    event_id = create_resp.json()["id"]

    # Update to member_b only
    resp = await client.put(
        f"{BASE}/{ws.slug}/events/{event_id}",
        json={"member_ids": [str(member_b.id)]},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["members"]) == 1
    assert body["members"][0]["id"] == str(member_b.id)


async def test_delete_event(client: AsyncClient, db: AsyncSession):
    """Delete an event, verify 204."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    create_resp = await client.post(
        f"{BASE}/{ws.slug}/events/",
        json=event_payload(title="ToDelete"),
        headers=headers,
    )
    assert create_resp.status_code == 201
    event_id = create_resp.json()["id"]

    del_resp = await client.delete(f"{BASE}/{ws.slug}/events/{event_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify gone
    get_resp = await client.get(f"{BASE}/{ws.slug}/events/{event_id}", headers=headers)
    assert get_resp.status_code == 404


async def test_event_workspace_isolation(client: AsyncClient, db: AsyncSession):
    """Event from workspace A not visible in workspace B."""
    _, ws_a, _, headers_a = await setup_workspace_with_user(
        db, email="a@example.com", slug="ws-a"
    )
    _, ws_b, _, headers_b = await setup_workspace_with_user(
        db, email="b@example.com", slug="ws-b"
    )

    # Create event in workspace A
    await client.post(
        f"{BASE}/{ws_a.slug}/events/",
        json=event_payload(title="Secret"),
        headers=headers_a,
    )

    # Workspace B should see 0 events
    resp = await client.get(f"{BASE}/{ws_b.slug}/events/", headers=headers_b)
    assert resp.status_code == 200
    assert len(resp.json()) == 0


async def test_viewer_cannot_create_event(client: AsyncClient, db: AsyncSession):
    """Viewer role gets 403 on event creation."""
    _, ws, _, headers = await setup_workspace_with_user(
        db, email="viewer@example.com", slug="viewer-ws", role="viewer"
    )

    resp = await client.post(
        f"{BASE}/{ws.slug}/events/",
        json=event_payload(title="Nope"),
        headers=headers,
    )
    assert resp.status_code == 403


async def test_create_event_invalid_member(client: AsyncClient, db: AsyncSession):
    """Non-existent member_id gets 400."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    fake_member_id = str(uuid.uuid4())
    payload = event_payload(title="BadMember", member_ids=[fake_member_id])
    resp = await client.post(f"{BASE}/{ws.slug}/events/", json=payload, headers=headers)

    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"].lower()
