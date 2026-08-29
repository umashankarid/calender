"""Tests for the voice interpretation API (/api/workspaces/{slug}/voice)."""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/api/workspaces"


def voice_url(slug: str) -> str:
    return f"{BASE}/{slug}/voice/interpret"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_event_intent(client, create_test_user, create_test_workspace):
    """'add badminton for Aadvika tomorrow 17-19' → intent=create_event."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "add badminton for Aadvika tomorrow 17-19"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "create_event"
    assert "Badminton" in body["data"]["title"]
    assert body["data"]["member_name"] == "Aadvika"
    assert body["confirmation_text"]


async def test_create_event_simple(client, create_test_user, create_test_workspace):
    """'meeting tomorrow at 10' → intent=create_event (simple pattern)."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "add meeting tomorrow at 10"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "create_event"
    assert "Meeting" in body["data"]["title"] or "meeting" in body["data"]["title"].lower()


async def test_query_events_intent(client, create_test_user, create_test_workspace):
    """'what is happening tomorrow' → intent=query_events."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "what is happening tomorrow"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "query_events"
    assert "start" in body["data"]
    assert "end" in body["data"]


async def test_delete_event_intent(client, create_test_user, create_test_workspace):
    """'cancel badminton tomorrow' → intent=delete_event."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "cancel badminton tomorrow"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "delete_event"
    assert "Badminton" in body["data"]["title"]
    assert body["data"]["date"]


async def test_create_reminder_intent(client, create_test_user, create_test_workspace):
    """'remind me to pack bag at 8' → intent=create_reminder."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "remind me to pack bag at 8"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "create_reminder"
    assert "remind_at" in body["data"]
    assert body["confirmation_text"]


async def test_unknown_intent(client, create_test_user, create_test_workspace):
    """Random text that doesn't clearly match a pattern falls back to create_event."""
    user, headers = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "the weather is nice today"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    # Unrecognised text now falls back to create_event (useful for shared SMS)
    assert body["intent"] == "create_event"


async def test_voice_requires_auth(client, create_test_user, create_test_workspace):
    """Request without JWT token returns 401."""
    user, _ = await create_test_user()
    workspace = await create_test_workspace(user.id)

    resp = await client.post(
        voice_url(workspace.slug),
        json={"text": "what is happening today"},
        # no headers — no auth
    )
    assert resp.status_code == 401
