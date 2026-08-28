"""Tests for announcement endpoints: /api/workspaces/{slug}/announcements."""

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


def announcement_payload(
    title: str = "Important Notice",
    body: str | None = "Please read carefully.",
    priority: str = "normal",
    **overrides,
) -> dict:
    """Build a JSON-serialisable announcement creation payload."""
    data: dict = {"title": title, "priority": priority}
    if body is not None:
        data["body"] = body
    data.update(overrides)
    return data


async def create_announcement(
    client: AsyncClient,
    slug: str,
    headers: dict,
    **kwargs,
):
    """Helper to POST an announcement and return the response."""
    payload = announcement_payload(**kwargs)
    return await client.post(
        f"{BASE}/{slug}/announcements/",
        json=payload,
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_announcement(client: AsyncClient, db: AsyncSession):
    """Create an announcement with title, body, priority — verify 201."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    resp = await create_announcement(
        client, ws.slug, headers,
        title="Launch Day",
        body="We go live tomorrow!",
        priority="high",
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Launch Day"
    assert body["body"] == "We go live tomorrow!"
    assert body["priority"] == "high"
    assert body["is_active"] is True
    assert body["workspace_id"] == str(ws.id)
    assert "id" in body


async def test_list_announcements(client: AsyncClient, db: AsyncSession):
    """List active announcements."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    await create_announcement(client, ws.slug, headers, title="Ann 1")
    await create_announcement(client, ws.slug, headers, title="Ann 2")
    await create_announcement(client, ws.slug, headers, title="Ann 3")

    resp = await client.get(f"{BASE}/{ws.slug}/announcements/", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    titles = {a["title"] for a in body}
    assert titles == {"Ann 1", "Ann 2", "Ann 3"}


async def test_update_announcement(client: AsyncClient, db: AsyncSession):
    """Update title and priority."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    create_resp = await create_announcement(
        client, ws.slug, headers, title="Old Title", priority="normal"
    )
    assert create_resp.status_code == 201
    ann_id = create_resp.json()["id"]

    resp = await client.put(
        f"{BASE}/{ws.slug}/announcements/{ann_id}",
        json={"title": "New Title", "priority": "urgent"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New Title"
    assert body["priority"] == "urgent"
    assert body["id"] == ann_id


async def test_delete_announcement(client: AsyncClient, db: AsyncSession):
    """Delete an announcement."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    create_resp = await create_announcement(client, ws.slug, headers, title="Temp")
    assert create_resp.status_code == 201
    ann_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"{BASE}/{ws.slug}/announcements/{ann_id}", headers=headers
    )
    assert del_resp.status_code == 204

    # Verify gone — list should be empty
    list_resp = await client.get(f"{BASE}/{ws.slug}/announcements/", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0


async def test_viewer_cannot_create_announcement(client: AsyncClient, db: AsyncSession):
    """Viewer role gets 403 when creating an announcement."""
    _, ws, _, headers = await setup_workspace_with_user(
        db, email="viewer@example.com", slug="viewer-ws", role="viewer"
    )

    resp = await create_announcement(client, ws.slug, headers, title="Blocked")
    assert resp.status_code == 403


async def test_announcement_workspace_isolation(client: AsyncClient, db: AsyncSession):
    """Announcements from workspace A are not visible in workspace B."""
    _, ws_a, _, headers_a = await setup_workspace_with_user(
        db, email="a@example.com", slug="ws-a"
    )
    _, ws_b, _, headers_b = await setup_workspace_with_user(
        db, email="b@example.com", slug="ws-b"
    )

    # Create announcement in workspace A
    create_resp = await create_announcement(
        client, ws_a.slug, headers_a, title="Only For A"
    )
    assert create_resp.status_code == 201

    # Workspace B should see 0
    resp = await client.get(f"{BASE}/{ws_b.slug}/announcements/", headers=headers_b)
    assert resp.status_code == 200
    assert len(resp.json()) == 0
