"""Tests for workspace member endpoints: list, invite, update, remove."""

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
    name: str = "Test WS",
    slug: str = "test-ws",
) -> dict:
    """Create a workspace and return the JSON response body."""
    resp = await client.post(
        "/api/workspaces/",
        json={"name": name, "slug": slug},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def invite_member(
    client: AsyncClient,
    slug: str,
    headers: dict,
    email: str,
    role: str = "viewer",
    display_name: str | None = None,
    display_color: str | None = None,
) -> dict:
    """Invite a member and return the raw response."""
    payload: dict = {"email": email, "role": role}
    if display_name is not None:
        payload["display_name"] = display_name
    if display_color is not None:
        payload["display_color"] = display_color
    resp = await client.post(
        f"/api/workspaces/{slug}/members/",
        json=payload,
        headers=headers,
    )
    return resp


async def setup_workspace_with_viewer(client: AsyncClient):
    """
    Convenience: register owner + viewer, create workspace, invite viewer.
    Returns (slug, owner_headers, viewer_headers, viewer_member_id).
    """
    _, owner_headers = await register_user(client, email="own@example.com", name="Own")
    _, viewer_headers = await register_user(client, email="viewer@example.com", name="Viewer")

    ws = await create_workspace(client, owner_headers, slug="ws-test")

    inv_resp = await invite_member(client, "ws-test", owner_headers, email="viewer@example.com", role="viewer")
    assert inv_resp.status_code == 201
    viewer_member_id = inv_resp.json()["id"]

    return "ws-test", owner_headers, viewer_headers, viewer_member_id


# ---------------------------------------------------------------------------
# List members
# ---------------------------------------------------------------------------


async def test_list_members(client: AsyncClient):
    _, headers = await register_user(client)
    ws = await create_workspace(client, headers)

    resp = await client.get(
        f"/api/workspaces/{ws['slug']}/members/",
        headers=headers,
    )
    assert resp.status_code == 200

    members = resp.json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"
    # Each member should include the nested user object
    assert "user" in members[0]
    assert members[0]["user"]["email"] == "owner@example.com"


# ---------------------------------------------------------------------------
# Invite member
# ---------------------------------------------------------------------------


async def test_invite_member(client: AsyncClient):
    _, headers = await register_user(client, email="owner@example.com")
    ws = await create_workspace(client, headers)

    # Invite a brand new email (creates a placeholder user)
    resp = await invite_member(
        client, ws["slug"], headers,
        email="newbie@example.com",
        role="viewer",
        display_name="Newbie",
    )
    assert resp.status_code == 201

    body = resp.json()
    assert body["role"] == "viewer"
    assert body["display_name"] == "Newbie"
    assert "user" in body
    assert body["user"]["email"] == "newbie@example.com"

    # Verify they appear in the member list
    list_resp = await client.get(
        f"/api/workspaces/{ws['slug']}/members/",
        headers=headers,
    )
    assert list_resp.status_code == 200
    emails = {m["user"]["email"] for m in list_resp.json()}
    assert "newbie@example.com" in emails


async def test_invite_existing_user(client: AsyncClient):
    _, owner_headers = await register_user(client, email="owner@example.com")
    # Pre-register the user we'll invite
    _, _ = await register_user(client, email="existing@example.com", name="Existing")

    ws = await create_workspace(client, owner_headers)

    resp = await invite_member(
        client, ws["slug"], owner_headers,
        email="existing@example.com",
        role="editor",
    )
    assert resp.status_code == 201

    body = resp.json()
    assert body["role"] == "editor"
    assert body["user"]["email"] == "existing@example.com"
    assert body["user"]["name"] == "Existing"


async def test_invite_duplicate(client: AsyncClient):
    _, headers = await register_user(client, email="owner@example.com")
    ws = await create_workspace(client, headers)

    resp1 = await invite_member(client, ws["slug"], headers, email="dup@example.com")
    assert resp1.status_code == 201

    resp2 = await invite_member(client, ws["slug"], headers, email="dup@example.com")
    assert resp2.status_code == 409
    assert "already a member" in resp2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Update member
# ---------------------------------------------------------------------------


async def test_update_member_role(client: AsyncClient):
    slug, owner_headers, _, viewer_member_id = await setup_workspace_with_viewer(client)

    resp = await client.put(
        f"/api/workspaces/{slug}/members/{viewer_member_id}",
        json={"role": "editor"},
        headers=owner_headers,
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["role"] == "editor"
    assert body["id"] == viewer_member_id


async def test_update_member_display_color(client: AsyncClient):
    slug, owner_headers, _, viewer_member_id = await setup_workspace_with_viewer(client)

    resp = await client.put(
        f"/api/workspaces/{slug}/members/{viewer_member_id}",
        json={"display_color": "#FF5733"},
        headers=owner_headers,
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["display_color"] == "#FF5733"


# ---------------------------------------------------------------------------
# Remove member
# ---------------------------------------------------------------------------


async def test_remove_member(client: AsyncClient):
    slug, owner_headers, _, viewer_member_id = await setup_workspace_with_viewer(client)

    resp = await client.delete(
        f"/api/workspaces/{slug}/members/{viewer_member_id}",
        headers=owner_headers,
    )
    assert resp.status_code == 204

    # Verify removal — member list should only have the owner
    list_resp = await client.get(
        f"/api/workspaces/{slug}/members/",
        headers=owner_headers,
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["role"] == "owner"


async def test_remove_last_owner_denied(client: AsyncClient):
    _, headers = await register_user(client)
    ws = await create_workspace(client, headers)

    # Get owner's member ID
    list_resp = await client.get(
        f"/api/workspaces/{ws['slug']}/members/",
        headers=headers,
    )
    owner_member_id = list_resp.json()[0]["id"]

    resp = await client.delete(
        f"/api/workspaces/{ws['slug']}/members/{owner_member_id}",
        headers=headers,
    )
    assert resp.status_code == 400
    assert "last owner" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Viewer permission restrictions
# ---------------------------------------------------------------------------


async def test_viewer_cannot_invite(client: AsyncClient):
    slug, _, viewer_headers, _ = await setup_workspace_with_viewer(client)

    resp = await invite_member(
        client, slug, viewer_headers,
        email="sneaky@example.com",
    )
    assert resp.status_code == 403


async def test_viewer_cannot_remove(client: AsyncClient):
    slug, owner_headers, viewer_headers, _ = await setup_workspace_with_viewer(client)

    # Get owner's member ID to attempt removal
    list_resp = await client.get(
        f"/api/workspaces/{slug}/members/",
        headers=owner_headers,
    )
    owner_member_id = [m["id"] for m in list_resp.json() if m["role"] == "owner"][0]

    resp = await client.delete(
        f"/api/workspaces/{slug}/members/{owner_member_id}",
        headers=viewer_headers,
    )
    assert resp.status_code == 403
