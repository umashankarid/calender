"""Tests for the displays API (/api/workspaces/{slug}/displays)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announcement import Announcement
from app.models.display import Display, DisplayWidget
from app.models.event import Event
from app.models.reminder import Reminder


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/api/workspaces"


def displays_url(slug: str, suffix: str = "") -> str:
    return f"{BASE}/{slug}/displays{suffix}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_register_display(client, create_test_user, create_test_workspace):
    """POST creates a display and returns token + pairing_code."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Kitchen Display"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Kitchen Display"
    assert body["token"]  # non-empty string
    assert body["pairing_code"]  # 6-digit code
    assert len(body["pairing_code"]) == 6
    assert body["is_paired"] is False


async def test_list_displays(client, create_test_user, create_test_workspace):
    """Create multiple displays, list all."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    for name in ["Kitchen", "Living Room", "Bedroom"]:
        resp = await client.post(
            displays_url(workspace.slug, "/"),
            json={"name": name},
            headers=headers,
        )
        assert resp.status_code == 201

    resp = await client.get(
        displays_url(workspace.slug, "/"),
        headers=headers,
    )
    assert resp.status_code == 200
    displays = resp.json()
    assert len(displays) == 3
    names = {d["name"] for d in displays}
    assert names == {"Kitchen", "Living Room", "Bedroom"}


async def test_pair_display(client, create_test_user, create_test_workspace):
    """Create display, then pair it using the pairing_code."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Hallway"},
        headers=headers,
    )
    assert resp.status_code == 201
    pairing_code = resp.json()["pairing_code"]

    # Pair (no auth needed — the code IS the auth)
    pair_resp = await client.post(
        displays_url(workspace.slug, "/pair"),
        params={"pairing_code": pairing_code},
    )
    assert pair_resp.status_code == 200
    pair_body = pair_resp.json()
    assert pair_body["name"] == "Hallway"
    assert pair_body["token"]
    assert pair_body["display_id"]


async def test_pair_display_invalid_code(client, create_test_user, create_test_workspace):
    """Wrong pairing code returns 404."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        displays_url(workspace.slug, "/pair"),
        params={"pairing_code": "000000"},
    )
    assert resp.status_code == 404
    assert "Invalid pairing code" in resp.json()["detail"]


async def test_pair_display_expired_code(
    client, db, create_test_user, create_test_workspace
):
    """An expired pairing code returns 410 GONE."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create display via API
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Expired Display"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    pairing_code = body["pairing_code"]
    display_id = body["id"]

    # Manually expire the code directly in the DB
    from sqlalchemy import select, update

    await db.execute(
        update(Display)
        .where(Display.id == uuid.UUID(display_id))
        .values(pairing_expires_at=datetime.now(timezone.utc) - timedelta(hours=1))
    )
    await db.commit()

    # Attempt pairing with expired code
    pair_resp = await client.post(
        displays_url(workspace.slug, "/pair"),
        params={"pairing_code": pairing_code},
    )
    assert pair_resp.status_code == 410
    assert "expired" in pair_resp.json()["detail"].lower()


async def test_get_display_feed_by_token(
    client, db, create_test_user, create_test_workspace
):
    """GET /by-token/{token}/today returns events for today."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create display
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Feed Display"},
        headers=headers,
    )
    assert resp.status_code == 201
    token = resp.json()["token"]

    # Create an event for today
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    event = Event(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        title="Team Meeting",
        start=today_start + timedelta(hours=10),
        end=today_start + timedelta(hours=11),
    )
    db.add(event)
    await db.commit()

    # Fetch feed
    feed_resp = await client.get(
        displays_url(workspace.slug, f"/by-token/{token}/today"),
    )
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    assert feed["date"] == today_start.date().isoformat()
    assert "workspace" in feed

    # The event should appear in events_by_member (unassigned since no members)
    all_events = []
    for member_events in feed["events_by_member"].values():
        all_events.extend(member_events)
    assert any(e["title"] == "Team Meeting" for e in all_events)


async def test_display_feed_includes_announcements(
    client, db, create_test_user, create_test_workspace
):
    """Active announcements appear in the display feed."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create display
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Announce Display"},
        headers=headers,
    )
    token = resp.json()["token"]

    # Create announcement directly in DB
    announcement = Announcement(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        title="Fire Drill",
        body="Meet at parking lot",
        priority="high",
        is_active=True,
    )
    db.add(announcement)
    await db.commit()

    # Fetch feed
    feed_resp = await client.get(
        displays_url(workspace.slug, f"/by-token/{token}/today"),
    )
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    assert len(feed["announcements"]) >= 1
    assert any(a["title"] == "Fire Drill" for a in feed["announcements"])


async def test_display_feed_includes_reminders(
    client, db, create_test_user, create_test_workspace
):
    """Pending reminders for today appear in the display feed."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create display
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Reminder Display"},
        headers=headers,
    )
    token = resp.json()["token"]

    # Create an event for today (reminder is linked to an event)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    event = Event(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        title="Pick up kids",
        start=today_start + timedelta(hours=15),
        end=today_start + timedelta(hours=16),
    )
    db.add(event)
    await db.flush()

    # Create a pending reminder for today
    reminder = Reminder(
        id=uuid.uuid4(),
        event_id=event.id,
        remind_at=today_start + timedelta(hours=14, minutes=30),
        message="Leave in 30 minutes",
        status="pending",
    )
    db.add(reminder)
    await db.commit()

    # Fetch feed
    feed_resp = await client.get(
        displays_url(workspace.slug, f"/by-token/{token}/today"),
    )
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    assert len(feed["reminders"]) >= 1
    assert any(r["message"] == "Leave in 30 minutes" for r in feed["reminders"])


async def test_update_display(client, create_test_user, create_test_workspace):
    """PUT updates display name and layout."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Old Name"},
        headers=headers,
    )
    assert resp.status_code == 201
    display_id = resp.json()["id"]

    # Update
    update_resp = await client.put(
        displays_url(workspace.slug, f"/{display_id}"),
        json={"name": "New Name", "layout": {"columns": 2, "theme": "dark"}},
        headers=headers,
    )
    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["name"] == "New Name"
    assert body["layout"] == {"columns": 2, "theme": "dark"}


async def test_update_display_widgets(client, create_test_user, create_test_workspace):
    """PUT /{display_id}/widgets replaces widgets in bulk."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    # Create display
    resp = await client.post(
        displays_url(workspace.slug, "/"),
        json={"name": "Widget Display"},
        headers=headers,
    )
    display_id = resp.json()["id"]

    widgets_payload = [
        {"widget_type": "clock", "position": 0, "config": {"format": "24h"}, "is_visible": True},
        {"widget_type": "calendar", "position": 1, "config": None, "is_visible": True},
        {"widget_type": "weather", "position": 2, "config": {"city": "Stockholm"}, "is_visible": False},
    ]

    # Bulk update widgets
    widget_resp = await client.put(
        displays_url(workspace.slug, f"/{display_id}/widgets"),
        json=widgets_payload,
        headers=headers,
    )
    assert widget_resp.status_code == 200
    widgets = widget_resp.json()
    assert len(widgets) == 3
    types = [w["widget_type"] for w in widgets]
    assert types == ["clock", "calendar", "weather"]
    assert widgets[0]["config"] == {"format": "24h"}
    assert widgets[2]["is_visible"] is False

    # Bulk replace with fewer widgets
    new_payload = [
        {"widget_type": "todo", "position": 0, "is_visible": True},
    ]
    replace_resp = await client.put(
        displays_url(workspace.slug, f"/{display_id}/widgets"),
        json=new_payload,
        headers=headers,
    )
    assert replace_resp.status_code == 200
    assert len(replace_resp.json()) == 1
    assert replace_resp.json()[0]["widget_type"] == "todo"
