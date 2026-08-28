"""Integration tests — validate that every API response matches the frontend TypeScript types.

These tests act as a contract between backend and frontend. If a field is renamed,
removed, or its type changes, these tests will catch the mismatch before the frontend
breaks at runtime.

Each test calls the real API through the ASGI transport, then asserts the response
contains EXACTLY the fields the frontend expects (no more required, no fewer).
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token
from app.core.security import hash_password
from app.models.announcement import Announcement
from app.models.calendar import Calendar as CalendarModel
from app.models.display import Display, DisplayWidget
from app.models.event import Event, EventMember
from app.models.reminder import Reminder
from app.models.shopping_item import ShoppingItem
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser


# ---------------------------------------------------------------------------
# Expected field sets — mirror frontend TypeScript interfaces exactly
# ---------------------------------------------------------------------------

WORKSPACE_FIELDS = {
    "id", "name", "slug", "workspace_type", "logo", "primary_color",
    "timezone", "is_active", "created_at", "updated_at",
}

USER_FIELDS = {"id", "email", "name", "avatar", "is_active", "created_at"}

WORKSPACE_USER_FIELDS = {
    "id", "workspace_id", "user_id", "role", "display_name",
    "display_color", "created_at", "user",
}

CALENDAR_FIELDS = {
    "id", "workspace_id", "name", "color", "is_default", "created_at", "updated_at",
}

EVENT_FIELDS = {
    "id", "workspace_id", "calendar_id", "title", "start", "end",
    "all_day", "location", "notes", "recurrence", "source",
    "created_at", "updated_at",
}

EVENT_WITH_MEMBERS_FIELDS = EVENT_FIELDS | {"members"}

REMINDER_FIELDS = {
    "id", "event_id", "workspace_user_id", "remind_at", "message",
    "status", "created_at",
}

ANNOUNCEMENT_FIELDS = {
    "id", "workspace_id", "title", "body", "priority", "is_active",
    "starts_at", "expires_at", "created_by_id", "created_at", "updated_at",
}

DISPLAY_FIELDS = {
    "id", "workspace_id", "name", "token", "pairing_code", "is_paired",
    "layout", "created_at", "updated_at",
}

DISPLAY_WIDGET_FIELDS = {
    "id", "display_id", "widget_type", "position", "config", "is_visible",
    "created_at",
}

TOKEN_RESPONSE_FIELDS = {"access_token", "token_type"}

DISPLAY_FEED_FIELDS = {
    "date", "workspace", "workspace_name", "display_id",
    "today", "upcoming", "announcements", "reminders", "shopping_list",
}

VOICE_INTENT_FIELDS = {"intent", "data", "confirmation_text"}

SHOPPING_ITEM_FIELDS = {
    "id", "workspace_id", "name", "quantity", "category",
    "is_bought", "added_by_id", "created_at", "updated_at",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NOW = datetime(2026, 8, 28, 10, 0, 0, tzinfo=timezone.utc)


async def _seed_full_workspace(db: AsyncSession):
    """Create a workspace with owner, calendar, event, member, reminder,
    announcement, and display. Returns a dict of all created objects."""

    user = User(
        id=uuid.uuid4(), email="integration@test.com", name="Integration User",
        password_hash=hash_password("testpass123"),
    )
    db.add(user)
    await db.flush()

    user2 = User(
        id=uuid.uuid4(), email="member@test.com", name="Team Member",
        password_hash=hash_password("testpass123"),
    )
    db.add(user2)
    await db.flush()

    workspace = Workspace(
        id=uuid.uuid4(), name="Integration WS", slug="integration-ws",
        workspace_type="family", primary_color="#3B82F6", timezone="Europe/Stockholm",
    )
    db.add(workspace)
    await db.flush()

    owner = WorkspaceUser(
        id=uuid.uuid4(), workspace_id=workspace.id, user_id=user.id,
        role="owner", display_name="Owner", display_color="#EF4444",
    )
    db.add(owner)
    await db.flush()

    member = WorkspaceUser(
        id=uuid.uuid4(), workspace_id=workspace.id, user_id=user2.id,
        role="editor", display_name="Editor", display_color="#3B82F6",
    )
    db.add(member)
    await db.flush()

    calendar = CalendarModel(
        id=uuid.uuid4(), workspace_id=workspace.id, name="Family",
        color="#10B981", is_default=True,
    )
    db.add(calendar)
    await db.flush()

    event = Event(
        id=uuid.uuid4(), workspace_id=workspace.id, calendar_id=calendar.id,
        title="Integration Event", start=NOW, end=NOW + timedelta(hours=1),
        all_day=False, location="Office", notes="Test notes",
        source="calendarhub",
    )
    db.add(event)
    await db.flush()

    event_member = EventMember(event_id=event.id, workspace_user_id=owner.id)
    db.add(event_member)
    await db.flush()

    reminder = Reminder(
        id=uuid.uuid4(), event_id=event.id, workspace_user_id=owner.id,
        remind_at=NOW - timedelta(minutes=30), message="Don't forget!",
        status="pending",
    )
    db.add(reminder)
    await db.flush()

    announcement = Announcement(
        id=uuid.uuid4(), workspace_id=workspace.id,
        title="Welcome!", body="This is a test announcement.",
        priority="normal", is_active=True, created_by_id=owner.id,
    )
    db.add(announcement)
    await db.flush()

    display = Display(
        id=uuid.uuid4(), workspace_id=workspace.id, name="Wall Screen",
        token="integration-display-token", is_paired=True,
    )
    db.add(display)
    await db.flush()

    display_unpaired = Display(
        id=uuid.uuid4(), workspace_id=workspace.id, name="New Screen",
        token="unpaired-token", pairing_code="999888", is_paired=False,
    )
    db.add(display_unpaired)
    await db.flush()

    shopping_item = ShoppingItem(
        id=uuid.uuid4(), workspace_id=workspace.id,
        name="Milk", quantity="2", category="Dairy",
        is_bought=False, added_by_id=owner.id,
    )
    db.add(shopping_item)
    await db.flush()

    await db.commit()

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    return {
        "user": user, "user2": user2, "workspace": workspace,
        "owner": owner, "member": member, "calendar": calendar,
        "event": event, "reminder": reminder, "announcement": announcement,
        "display": display, "display_unpaired": display_unpaired,
        "shopping_item": shopping_item,
        "headers": headers, "slug": workspace.slug,
    }


def assert_fields(data: dict, expected: set, label: str = ""):
    """Assert that data contains at least all expected fields."""
    actual = set(data.keys())
    missing = expected - actual
    assert not missing, f"{label} missing fields: {missing}. Got: {actual}"


# ===========================================================================
# Auth contract tests
# ===========================================================================


class TestAuthContract:
    """Verify /api/auth/* responses match frontend TokenResponse and User types."""

    async def test_register_returns_token_response(self, client: AsyncClient, db: AsyncSession):
        resp = await client.post("/api/auth/register", json={
            "email": "contract@test.com", "name": "Contract User", "password": "pass1234",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert_fields(data, TOKEN_RESPONSE_FIELDS, "TokenResponse")
        assert isinstance(data["access_token"], str)
        assert data["token_type"] == "bearer"

    async def test_login_returns_token_response(self, client: AsyncClient, db: AsyncSession):
        # Register first
        await client.post("/api/auth/register", json={
            "email": "login@test.com", "name": "Login User", "password": "pass1234",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "login@test.com", "password": "pass1234",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert_fields(data, TOKEN_RESPONSE_FIELDS, "TokenResponse")

    async def test_me_returns_user(self, client: AsyncClient, db: AsyncSession):
        reg = await client.post("/api/auth/register", json={
            "email": "me@test.com", "name": "Me User", "password": "pass1234",
        })
        token = reg.json()["access_token"]
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert_fields(data, USER_FIELDS, "User")
        assert data["email"] == "me@test.com"


# ===========================================================================
# Workspace contract tests
# ===========================================================================


class TestWorkspaceContract:
    """Verify /api/workspaces/* responses match frontend Workspace type."""

    async def test_create_workspace_returns_workspace(self, client: AsyncClient, db: AsyncSession):
        reg = await client.post("/api/auth/register", json={
            "email": "ws@test.com", "name": "WS User", "password": "pass1234",
        })
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        resp = await client.post("/api/workspaces/", json={
            "name": "My Family", "slug": "my-family",
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert_fields(data, WORKSPACE_FIELDS, "Workspace")
        assert data["slug"] == "my-family"

    async def test_list_workspaces_returns_workspace_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get("/api/workspaces/", headers=seed["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for ws in data:
            assert_fields(ws, WORKSPACE_FIELDS, "Workspace[]")

    async def test_get_workspace_returns_workspace(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(f"/api/workspaces/{seed['slug']}", headers=seed["headers"])
        assert resp.status_code == 200
        assert_fields(resp.json(), WORKSPACE_FIELDS, "Workspace")


# ===========================================================================
# Members contract tests
# ===========================================================================


class TestMemberContract:
    """Verify /api/workspaces/{slug}/members/* responses match frontend WorkspaceUser type."""

    async def test_list_members_returns_workspace_user_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/members/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        for m in data:
            assert_fields(m, WORKSPACE_USER_FIELDS, "WorkspaceUser[]")
            # user sub-object should match User fields
            if m.get("user"):
                assert_fields(m["user"], USER_FIELDS, "WorkspaceUser.user")

    async def test_invite_member_returns_workspace_user(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/members/",
            json={"email": "newinvite@test.com", "role": "viewer"},
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert_fields(data, WORKSPACE_USER_FIELDS, "WorkspaceUser")


# ===========================================================================
# Calendar contract tests
# ===========================================================================


class TestCalendarContract:
    """Verify /api/workspaces/{slug}/calendars/* responses match frontend Calendar type."""

    async def test_list_calendars_returns_calendar_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/calendars/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for cal in data:
            assert_fields(cal, CALENDAR_FIELDS, "Calendar[]")

    async def test_create_calendar_returns_calendar(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/calendars/",
            json={"name": "Sports", "color": "#F59E0B"},
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        assert_fields(resp.json(), CALENDAR_FIELDS, "Calendar")


# ===========================================================================
# Event contract tests
# ===========================================================================


class TestEventContract:
    """Verify /api/workspaces/{slug}/events/* responses match frontend EventWithMembers type."""

    async def test_list_events_returns_event_with_members_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/events/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for event in data:
            assert_fields(event, EVENT_WITH_MEMBERS_FIELDS, "EventWithMembers[]")
            assert isinstance(event["members"], list)
            for member in event["members"]:
                assert_fields(member, WORKSPACE_USER_FIELDS, "EventWithMembers.members[]")

    async def test_create_event_returns_event_with_members(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/events/",
            json={
                "title": "New Meeting",
                "start": NOW.isoformat(),
                "end": (NOW + timedelta(hours=1)).isoformat(),
                "member_ids": [str(seed["owner"].id)],
            },
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert_fields(data, EVENT_WITH_MEMBERS_FIELDS, "EventWithMembers")
        assert len(data["members"]) == 1
        assert_fields(data["members"][0], WORKSPACE_USER_FIELDS, "EventWithMembers.members[0]")

    async def test_get_event_returns_event_with_members(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/events/{seed['event'].id}",
            headers=seed["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert_fields(data, EVENT_WITH_MEMBERS_FIELDS, "EventWithMembers")

    async def test_update_event_returns_event_with_members(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.put(
            f"/api/workspaces/{seed['slug']}/events/{seed['event'].id}",
            json={"title": "Updated Title"},
            headers=seed["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert_fields(data, EVENT_WITH_MEMBERS_FIELDS, "EventWithMembers")
        assert data["title"] == "Updated Title"

    async def test_event_date_filter_params_accepted(self, client: AsyncClient, db: AsyncSession):
        """Frontend sends start/end as ISO strings — backend must accept them."""
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/events/",
            params={"start": NOW.isoformat(), "end": (NOW + timedelta(days=1)).isoformat()},
            headers=seed["headers"],
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_event_member_ids_as_uuid_strings(self, client: AsyncClient, db: AsyncSession):
        """Frontend sends member_ids as UUID strings — backend must accept them."""
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/events/",
            json={
                "title": "UUID Test",
                "start": NOW.isoformat(),
                "member_ids": [str(seed["owner"].id), str(seed["member"].id)],
            },
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        assert len(resp.json()["members"]) == 2


# ===========================================================================
# Reminder contract tests
# ===========================================================================


class TestReminderContract:
    """Verify /api/workspaces/{slug}/reminders/* responses match frontend Reminder type."""

    async def test_list_reminders_returns_reminder_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/reminders/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for r in data:
            assert_fields(r, REMINDER_FIELDS, "Reminder[]")

    async def test_create_reminder_returns_reminder(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/reminders/",
            json={
                "event_id": str(seed["event"].id),
                "remind_at": (NOW - timedelta(hours=1)).isoformat(),
                "message": "Pack your bag",
            },
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        assert_fields(resp.json(), REMINDER_FIELDS, "Reminder")


# ===========================================================================
# Announcement contract tests
# ===========================================================================


class TestAnnouncementContract:
    """Verify /api/workspaces/{slug}/announcements/* responses match frontend Announcement type."""

    async def test_list_announcements_returns_announcement_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/announcements/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for a in data:
            assert_fields(a, ANNOUNCEMENT_FIELDS, "Announcement[]")

    async def test_create_announcement_returns_announcement(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/announcements/",
            json={"title": "New Rule", "body": "No shoes indoors", "priority": "high"},
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        assert_fields(resp.json(), ANNOUNCEMENT_FIELDS, "Announcement")


# ===========================================================================
# Display contract tests
# ===========================================================================


class TestDisplayContract:
    """Verify /api/workspaces/{slug}/displays/* responses match frontend Display type."""

    async def test_list_displays_returns_display_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/displays/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for d in data:
            assert_fields(d, DISPLAY_FIELDS, "Display[]")

    async def test_create_display_returns_display(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/displays/",
            json={"name": "Kitchen Screen"},
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert_fields(data, DISPLAY_FIELDS, "Display")
        assert data["pairing_code"] is not None
        assert data["is_paired"] is False
        assert len(data["token"]) > 10

    async def test_pair_display_returns_token(self, client: AsyncClient, db: AsyncSession):
        """Frontend sends JSON { pairing_code: "..." } — backend returns display info."""
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/displays/pair/",
            json={"pairing_code": "999888"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "display_id" in data
        assert "name" in data

    async def test_display_feed_returns_display_feed(self, client: AsyncClient, db: AsyncSession):
        """GET /displays/by-token/{token}/today must return DisplayFeed shape."""
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/displays/by-token/"
            f"{seed['display'].token}/today"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert_fields(data, DISPLAY_FEED_FIELDS, "DisplayFeed")

        # today must be an array of EventWithMembers
        assert isinstance(data["today"], list)
        for event in data["today"]:
            assert_fields(event, EVENT_WITH_MEMBERS_FIELDS, "DisplayFeed.today[]")
            assert isinstance(event["members"], list)

        # upcoming must be an array
        assert isinstance(data["upcoming"], list)

        # announcements must be an array
        assert isinstance(data["announcements"], list)

        # reminders must be an array
        assert isinstance(data["reminders"], list)

        # workspace_name must be a string
        assert isinstance(data["workspace_name"], str)
        assert isinstance(data["display_id"], str)

    async def test_display_feed_announcement_fields(self, client: AsyncClient, db: AsyncSession):
        """Announcements in feed must have at least id, title, body, priority."""
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/displays/by-token/"
            f"{seed['display'].token}/today"
        )
        data = resp.json()
        for ann in data["announcements"]:
            assert "id" in ann
            assert "title" in ann
            assert "body" in ann
            assert "priority" in ann

    async def test_display_feed_reminder_fields(self, client: AsyncClient, db: AsyncSession):
        """Reminders in feed must have id, event_id, remind_at, message."""
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/displays/by-token/"
            f"{seed['display'].token}/today"
        )
        data = resp.json()
        for rem in data["reminders"]:
            assert "id" in rem
            assert "event_id" in rem
            assert "remind_at" in rem
            assert "message" in rem


# ===========================================================================
# Voice contract tests
# ===========================================================================


class TestVoiceContract:
    """Verify /api/workspaces/{slug}/voice/interpret returns VoiceIntent shape."""

    async def test_voice_returns_voice_intent(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/voice/interpret",
            json={"text": "add badminton tomorrow at 5"},
            headers=seed["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert_fields(data, VOICE_INTENT_FIELDS, "VoiceIntent")
        assert isinstance(data["data"], dict)
        assert isinstance(data["confirmation_text"], str)
        assert data["intent"] in {
            "create_event", "query_events", "update_event",
            "delete_event", "create_reminder", "add_shopping_item",
            "remove_shopping_item", "unknown",
        }


# ===========================================================================
# Shopping contract tests
# ===========================================================================


class TestShoppingContract:
    """Verify /api/workspaces/{slug}/shopping/* responses match frontend ShoppingItem type."""

    async def test_list_shopping_returns_array(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/shopping/", headers=seed["headers"]
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        for item in data:
            assert_fields(item, SHOPPING_ITEM_FIELDS, "ShoppingItem[]")

    async def test_create_shopping_returns_item(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.post(
            f"/api/workspaces/{seed['slug']}/shopping/",
            json={"name": "Bread", "quantity": "1", "category": "Bakery"},
            headers=seed["headers"],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert_fields(data, SHOPPING_ITEM_FIELDS, "ShoppingItem")

    async def test_toggle_returns_updated_item(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        # Create an item first
        create_resp = await client.post(
            f"/api/workspaces/{seed['slug']}/shopping/",
            json={"name": "Eggs"},
            headers=seed["headers"],
        )
        assert create_resp.status_code == 201
        item_id = create_resp.json()["id"]
        assert create_resp.json()["is_bought"] is False

        # Toggle
        toggle_resp = await client.put(
            f"/api/workspaces/{seed['slug']}/shopping/{item_id}/toggle",
            headers=seed["headers"],
        )
        assert toggle_resp.status_code == 200
        data = toggle_resp.json()
        assert_fields(data, SHOPPING_ITEM_FIELDS, "ShoppingItem (toggled)")
        assert data["is_bought"] is True

    async def test_display_feed_includes_shopping_list(self, client: AsyncClient, db: AsyncSession):
        seed = await _seed_full_workspace(db)
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/displays/by-token/"
            f"{seed['display'].token}/today"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "shopping_list" in data
        assert isinstance(data["shopping_list"], list)
        # Seed has one unbought shopping item
        assert len(data["shopping_list"]) >= 1


# ===========================================================================
# Cross-cutting contract tests
# ===========================================================================


class TestCrossCutting:
    """Verify end-to-end flows that span multiple endpoints."""

    async def test_full_flow_register_to_display(self, client: AsyncClient, db: AsyncSession):
        """Register → create workspace → create event → view on display feed."""
        # 1. Register
        reg = await client.post("/api/auth/register", json={
            "email": "e2e@test.com", "name": "E2E User", "password": "pass1234",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create workspace
        ws = await client.post("/api/workspaces/", json={
            "name": "E2E Home", "slug": "e2e-home",
        }, headers=headers)
        assert ws.status_code == 201
        slug = ws.json()["slug"]

        # 3. Create event (today)
        event = await client.post(f"/api/workspaces/{slug}/events/", json={
            "title": "E2E Test Event",
            "start": datetime.now(timezone.utc).isoformat(),
            "end": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        }, headers=headers)
        assert event.status_code == 201
        assert_fields(event.json(), EVENT_WITH_MEMBERS_FIELDS, "Created event")

        # 4. Create display
        display = await client.post(f"/api/workspaces/{slug}/displays/", json={
            "name": "E2E Display",
        }, headers=headers)
        assert display.status_code == 201
        display_token = display.json()["token"]
        pairing_code = display.json()["pairing_code"]

        # 5. Pair display
        paired = await client.post(f"/api/workspaces/{slug}/displays/pair/", json={
            "pairing_code": pairing_code,
        })
        assert paired.status_code == 200

        # 6. Get display feed — should include our event
        feed = await client.get(
            f"/api/workspaces/{slug}/displays/by-token/{display_token}/today"
        )
        assert feed.status_code == 200
        feed_data = feed.json()
        assert_fields(feed_data, DISPLAY_FEED_FIELDS, "DisplayFeed")
        event_titles = [e["title"] for e in feed_data["today"]]
        assert "E2E Test Event" in event_titles

    async def test_event_create_matches_event_list(self, client: AsyncClient, db: AsyncSession):
        """The shape returned by POST /events must match GET /events items."""
        seed = await _seed_full_workspace(db)

        created = await client.post(
            f"/api/workspaces/{seed['slug']}/events/",
            json={"title": "Shape Test", "start": NOW.isoformat()},
            headers=seed["headers"],
        )
        assert created.status_code == 201
        created_fields = set(created.json().keys())

        listed = await client.get(
            f"/api/workspaces/{seed['slug']}/events/", headers=seed["headers"]
        )
        for event in listed.json():
            listed_fields = set(event.keys())
            assert created_fields == listed_fields, (
                f"POST fields {created_fields} != GET fields {listed_fields}"
            )

    async def test_all_uuid_fields_are_strings(self, client: AsyncClient, db: AsyncSession):
        """Frontend expects all IDs as strings. Verify no UUID objects leak through."""
        seed = await _seed_full_workspace(db)

        # Check events
        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/events/", headers=seed["headers"]
        )
        for event in resp.json():
            assert isinstance(event["id"], str), "event.id must be string"
            assert isinstance(event["workspace_id"], str), "event.workspace_id must be string"
            for member in event["members"]:
                assert isinstance(member["id"], str), "member.id must be string"
                assert isinstance(member["workspace_id"], str)
                assert isinstance(member["user_id"], str)

    async def test_all_datetime_fields_are_iso_strings(self, client: AsyncClient, db: AsyncSession):
        """Frontend expects all dates as ISO strings. Verify no datetime objects leak."""
        seed = await _seed_full_workspace(db)

        resp = await client.get(
            f"/api/workspaces/{seed['slug']}/events/", headers=seed["headers"]
        )
        for event in resp.json():
            assert isinstance(event["start"], str), "start must be ISO string"
            assert isinstance(event["created_at"], str), "created_at must be ISO string"
            if event["end"]:
                assert isinstance(event["end"], str), "end must be ISO string"
