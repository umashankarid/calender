"""Tests for shopping list endpoints: /api/workspaces/{slug}/shopping."""

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


async def add_item(
    client: AsyncClient,
    slug: str,
    headers: dict,
    name: str = "Milk",
    quantity: str | None = None,
    category: str | None = None,
):
    """Helper to POST a shopping item and return the response."""
    payload: dict = {"name": name}
    if quantity is not None:
        payload["quantity"] = quantity
    if category is not None:
        payload["category"] = category
    return await client.post(
        f"{BASE}/{slug}/shopping/",
        json=payload,
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_add_item(client: AsyncClient, db: AsyncSession):
    """POST item, verify 201 with correct fields."""
    _, ws, member, headers = await setup_workspace_with_user(db)

    resp = await add_item(client, ws.slug, headers, name="Milk", quantity="2", category="Dairy")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Milk"
    assert body["quantity"] == "2"
    assert body["category"] == "Dairy"
    assert body["is_bought"] is False
    assert body["workspace_id"] == str(ws.id)
    assert body["added_by_id"] == str(member.id)
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


async def test_list_items(client: AsyncClient, db: AsyncSession):
    """Add 3 items, list all."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    await add_item(client, ws.slug, headers, name="Milk")
    await add_item(client, ws.slug, headers, name="Bread")
    await add_item(client, ws.slug, headers, name="Eggs")

    resp = await client.get(f"{BASE}/{ws.slug}/shopping/", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    names = {item["name"] for item in body}
    assert names == {"Milk", "Bread", "Eggs"}


async def test_list_items_filter_bought(client: AsyncClient, db: AsyncSession):
    """Filter by is_bought."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    r1 = await add_item(client, ws.slug, headers, name="Milk")
    await add_item(client, ws.slug, headers, name="Bread")
    await add_item(client, ws.slug, headers, name="Eggs")

    # Toggle milk to bought
    item_id = r1.json()["id"]
    await client.put(f"{BASE}/{ws.slug}/shopping/{item_id}/toggle", headers=headers)

    # Filter bought
    resp = await client.get(f"{BASE}/{ws.slug}/shopping/", params={"is_bought": "true"}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["name"] == "Milk"

    # Filter not bought
    resp2 = await client.get(f"{BASE}/{ws.slug}/shopping/", params={"is_bought": "false"}, headers=headers)
    assert resp2.status_code == 200
    assert len(resp2.json()) == 2


async def test_toggle_item(client: AsyncClient, db: AsyncSession):
    """Toggle is_bought."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    r = await add_item(client, ws.slug, headers, name="Milk")
    item_id = r.json()["id"]
    assert r.json()["is_bought"] is False

    # Toggle to bought
    resp = await client.put(f"{BASE}/{ws.slug}/shopping/{item_id}/toggle", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_bought"] is True

    # Toggle back
    resp2 = await client.put(f"{BASE}/{ws.slug}/shopping/{item_id}/toggle", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["is_bought"] is False


async def test_update_item(client: AsyncClient, db: AsyncSession):
    """Update name and quantity."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    r = await add_item(client, ws.slug, headers, name="Milk", quantity="1")
    item_id = r.json()["id"]

    resp = await client.put(
        f"{BASE}/{ws.slug}/shopping/{item_id}",
        json={"name": "Whole Milk", "quantity": "2 liters"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Whole Milk"
    assert body["quantity"] == "2 liters"


async def test_delete_item(client: AsyncClient, db: AsyncSession):
    """Delete single item."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    r = await add_item(client, ws.slug, headers, name="Milk")
    item_id = r.json()["id"]

    del_resp = await client.delete(f"{BASE}/{ws.slug}/shopping/{item_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify gone
    list_resp = await client.get(f"{BASE}/{ws.slug}/shopping/", headers=headers)
    assert len(list_resp.json()) == 0


async def test_delete_bought(client: AsyncClient, db: AsyncSession):
    """Add 3, mark 2 bought, delete bought, verify 1 remains."""
    _, ws, _, headers = await setup_workspace_with_user(db)

    r1 = await add_item(client, ws.slug, headers, name="Milk")
    r2 = await add_item(client, ws.slug, headers, name="Bread")
    r3 = await add_item(client, ws.slug, headers, name="Eggs")

    # Mark Milk and Bread as bought
    await client.put(f"{BASE}/{ws.slug}/shopping/{r1.json()['id']}/toggle", headers=headers)
    await client.put(f"{BASE}/{ws.slug}/shopping/{r2.json()['id']}/toggle", headers=headers)

    # Delete all bought items
    del_resp = await client.delete(f"{BASE}/{ws.slug}/shopping/bought", headers=headers)
    assert del_resp.status_code == 204

    # Verify only Eggs remains
    list_resp = await client.get(f"{BASE}/{ws.slug}/shopping/", headers=headers)
    body = list_resp.json()
    assert len(body) == 1
    assert body[0]["name"] == "Eggs"


async def test_viewer_cannot_add(client: AsyncClient, db: AsyncSession):
    """Viewer role gets 403 when adding an item."""
    _, ws, _, headers = await setup_workspace_with_user(
        db, email="viewer@example.com", slug="viewer-ws", role="viewer"
    )

    resp = await add_item(client, ws.slug, headers, name="Milk")
    assert resp.status_code == 403


async def test_workspace_isolation(client: AsyncClient, db: AsyncSession):
    """Items from workspace A not visible in workspace B."""
    _, ws_a, _, headers_a = await setup_workspace_with_user(
        db, email="a@example.com", slug="ws-a"
    )
    _, ws_b, _, headers_b = await setup_workspace_with_user(
        db, email="b@example.com", slug="ws-b"
    )

    # Add item to workspace A
    resp = await add_item(client, ws_a.slug, headers_a, name="Milk")
    assert resp.status_code == 201

    # Workspace B should see 0 items
    list_resp = await client.get(f"{BASE}/{ws_b.slug}/shopping/", headers=headers_b)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0
