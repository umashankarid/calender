"""Tests for workspace endpoints: create, list, get, update."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def register_user(
    client: AsyncClient,
    email: str = "owner@example.com",
    name: str = "Owner",
    password: str = "securePass1!",
) -> tuple[str, dict]:
    """Register a user via the API, return (access_token, auth_headers)."""
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "name": name, "password": password},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


async def create_workspace(
    client: AsyncClient,
    headers: dict,
    name: str = "Family Hub",
    slug: str = "family-hub",
) -> dict:
    """Create a workspace and return the JSON response body."""
    resp = await client.post(
        "/api/workspaces/",
        json={"name": name, "slug": slug},
        headers=headers,
    )
    return resp


# ---------------------------------------------------------------------------
# Create workspace
# ---------------------------------------------------------------------------


async def test_create_workspace(client: AsyncClient):
    _, headers = await register_user(client)

    resp = await create_workspace(client, headers)
    assert resp.status_code == 201

    body = resp.json()
    assert body["name"] == "Family Hub"
    assert body["slug"] == "family-hub"
    assert "id" in body
    assert body["is_active"] is True
    assert body["workspace_type"] == "family"

    # Verify the creator is an owner by listing members
    members_resp = await client.get(
        f"/api/workspaces/{body['slug']}/members/",
        headers=headers,
    )
    assert members_resp.status_code == 200
    members = members_resp.json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"


async def test_create_workspace_duplicate_slug(client: AsyncClient):
    _, headers = await register_user(client)

    resp1 = await create_workspace(client, headers, slug="dup-slug")
    assert resp1.status_code == 201

    resp2 = await create_workspace(client, headers, name="Another", slug="dup-slug")
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"].lower()


async def test_create_workspace_unauthenticated(client: AsyncClient):
    resp = await client.post(
        "/api/workspaces/",
        json={"name": "Sneaky", "slug": "sneaky"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List workspaces
# ---------------------------------------------------------------------------


async def test_list_workspaces(client: AsyncClient):
    _, headers = await register_user(client)

    await create_workspace(client, headers, name="WS One", slug="ws-one")
    await create_workspace(client, headers, name="WS Two", slug="ws-two")

    resp = await client.get("/api/workspaces/", headers=headers)
    assert resp.status_code == 200

    body = resp.json()
    assert len(body) == 2
    slugs = {ws["slug"] for ws in body}
    assert slugs == {"ws-one", "ws-two"}


async def test_list_workspaces_only_own(client: AsyncClient):
    _, headers_a = await register_user(client, email="a@example.com", name="A")
    _, headers_b = await register_user(client, email="b@example.com", name="B")

    await create_workspace(client, headers_a, name="A's WS", slug="a-ws")
    await create_workspace(client, headers_b, name="B's WS", slug="b-ws")

    # User A should only see their own workspace
    resp_a = await client.get("/api/workspaces/", headers=headers_a)
    assert resp_a.status_code == 200
    ws_a = resp_a.json()
    assert len(ws_a) == 1
    assert ws_a[0]["slug"] == "a-ws"

    # User B should only see their own workspace
    resp_b = await client.get("/api/workspaces/", headers=headers_b)
    assert resp_b.status_code == 200
    ws_b = resp_b.json()
    assert len(ws_b) == 1
    assert ws_b[0]["slug"] == "b-ws"


# ---------------------------------------------------------------------------
# Get workspace by slug
# ---------------------------------------------------------------------------


async def test_get_workspace_by_slug(client: AsyncClient):
    _, headers = await register_user(client)
    create_resp = await create_workspace(client, headers, name="Detail WS", slug="detail-ws")
    assert create_resp.status_code == 201

    resp = await client.get("/api/workspaces/detail-ws", headers=headers)
    assert resp.status_code == 200

    body = resp.json()
    assert body["slug"] == "detail-ws"
    assert body["name"] == "Detail WS"
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


async def test_get_workspace_nonexistent(client: AsyncClient):
    _, headers = await register_user(client)

    resp = await client.get("/api/workspaces/does-not-exist", headers=headers)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


async def test_get_workspace_non_member(client: AsyncClient):
    _, headers_a = await register_user(client, email="owner@example.com", name="Owner")
    _, headers_b = await register_user(client, email="outsider@example.com", name="Outsider")

    create_resp = await create_workspace(client, headers_a, name="Private", slug="private")
    assert create_resp.status_code == 201

    resp = await client.get("/api/workspaces/private", headers=headers_b)
    assert resp.status_code == 403
    assert "not a member" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Update workspace
# ---------------------------------------------------------------------------


async def test_update_workspace(client: AsyncClient):
    _, headers = await register_user(client)
    create_resp = await create_workspace(client, headers, name="Old Name", slug="upd-ws")
    assert create_resp.status_code == 201

    resp = await client.put(
        "/api/workspaces/upd-ws",
        json={"name": "New Name"},
        headers=headers,
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["name"] == "New Name"
    assert body["slug"] == "upd-ws"  # slug should not change

    # Verify the change persists on re-fetch
    get_resp = await client.get("/api/workspaces/upd-ws", headers=headers)
    assert get_resp.json()["name"] == "New Name"


async def test_update_workspace_viewer_denied(client: AsyncClient):
    _, headers_owner = await register_user(client, email="own@example.com", name="Own")
    _, headers_viewer = await register_user(client, email="view@example.com", name="View")

    create_resp = await create_workspace(client, headers_owner, name="Restricted", slug="restricted")
    assert create_resp.status_code == 201

    # Owner invites viewer
    invite_resp = await client.post(
        "/api/workspaces/restricted/members/",
        json={"email": "view@example.com", "role": "viewer"},
        headers=headers_owner,
    )
    assert invite_resp.status_code == 201

    # Viewer tries to update — should be denied
    resp = await client.put(
        "/api/workspaces/restricted",
        json={"name": "Hacked Name"},
        headers=headers_viewer,
    )
    assert resp.status_code == 403
