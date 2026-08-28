"""Tests for authentication endpoints: register, login, me."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def register_user(
    client: AsyncClient,
    email: str = "alice@example.com",
    name: str = "Alice",
    password: str = "securePass1!",
) -> dict:
    """Register a user via the API and return the parsed JSON response."""
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "name": name, "password": password},
    )
    return resp


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


async def test_register_success(client: AsyncClient):
    resp = await register_user(client)

    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 0


async def test_register_duplicate_email(client: AsyncClient):
    resp1 = await register_user(client, email="dup@example.com")
    assert resp1.status_code == 201

    # Re-registering with same email claims the account (updates name/password)
    resp2 = await register_user(client, email="dup@example.com", name="New Name")
    assert resp2.status_code == 201
    assert "access_token" in resp2.json()


async def test_register_invalid_email(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "name": "Bad", "password": "password123"},
    )
    assert resp.status_code == 422


async def test_register_missing_fields(client: AsyncClient):
    # Missing name and password
    resp = await client.post("/api/auth/register", json={"email": "x@example.com"})
    assert resp.status_code == 422

    # Missing email entirely
    resp2 = await client.post(
        "/api/auth/register", json={"name": "NoEmail", "password": "pass123"}
    )
    assert resp2.status_code == 422

    # Empty body
    resp3 = await client.post("/api/auth/register", json={})
    assert resp3.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


async def test_login_success(client: AsyncClient):
    await register_user(client, email="login@example.com", password="myPass99!")

    resp = await client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "myPass99!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 0


async def test_login_wrong_password(client: AsyncClient):
    await register_user(client, email="wrong@example.com", password="correctPass1!")

    resp = await client.post(
        "/api/auth/login",
        json={"email": "wrong@example.com", "password": "wrongPassword"},
    )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


async def test_login_nonexistent_email(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "ghost@example.com", "password": "anything"},
    )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# /me endpoint
# ---------------------------------------------------------------------------


async def test_me_authenticated(client: AsyncClient):
    reg = await register_user(client, email="me@example.com", name="MeUser")
    token = reg.json()["access_token"]

    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "me@example.com"
    assert body["name"] == "MeUser"
    assert "id" in body
    assert body["is_active"] is True


async def test_me_no_token(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_invalid_token(client: AsyncClient):
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
    )
    assert resp.status_code == 401
