"""Tests for Pydantic schema validation."""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.announcement import AnnouncementCreate
from app.schemas.display import DisplayCreate
from app.schemas.event import EventCreate
from app.schemas.reminder import ReminderCreate
from app.schemas.user import UserCreate
from app.schemas.workspace import WorkspaceCreate


# ---------------------------------------------------------------------------
# Workspace schemas
# ---------------------------------------------------------------------------


def test_workspace_create_valid():
    ws = WorkspaceCreate(name="Family Hub", slug="family-hub")
    assert ws.name == "Family Hub"
    assert ws.slug == "family-hub"
    assert ws.workspace_type == "family"
    assert ws.timezone == "Europe/Stockholm"


def test_workspace_create_missing_name():
    with pytest.raises(ValidationError):
        WorkspaceCreate(slug="no-name")  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------


def test_user_create_valid():
    user = UserCreate(email="alice@example.com", name="Alice", password="secret123")
    assert user.email == "alice@example.com"
    assert user.name == "Alice"
    assert user.password == "secret123"


def test_user_create_invalid_email():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", name="Bob", password="secret123")


# ---------------------------------------------------------------------------
# Event schemas
# ---------------------------------------------------------------------------


def test_event_create_valid():
    now = datetime.now(timezone.utc)
    event = EventCreate(
        title="Team Standup",
        start=now,
        end=now,
        location="Room 3",
    )
    assert event.title == "Team Standup"
    assert event.start == now
    assert event.all_day is False
    assert event.member_ids == []


def test_event_create_missing_title():
    with pytest.raises(ValidationError):
        EventCreate(start=datetime.now(timezone.utc))  # type: ignore[call-arg]


def test_event_create_missing_start():
    with pytest.raises(ValidationError):
        EventCreate(title="No Start")  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# Reminder schemas
# ---------------------------------------------------------------------------


def test_reminder_create_valid():
    event_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    reminder = ReminderCreate(
        event_id=event_id,
        remind_at=now,
        message="Don't forget!",
    )
    assert reminder.event_id == event_id
    assert reminder.remind_at == now
    assert reminder.message == "Don't forget!"


# ---------------------------------------------------------------------------
# Announcement schemas
# ---------------------------------------------------------------------------


def test_announcement_create_valid():
    ann = AnnouncementCreate(
        title="Holiday Notice",
        body="Office closed on Monday",
        priority="high",
    )
    assert ann.title == "Holiday Notice"
    assert ann.body == "Office closed on Monday"
    assert ann.priority == "high"
    assert ann.starts_at is None
    assert ann.expires_at is None


# ---------------------------------------------------------------------------
# Display schemas
# ---------------------------------------------------------------------------


def test_display_create_valid():
    display = DisplayCreate(name="Kitchen Screen")
    assert display.name == "Kitchen Screen"
