"""Tests for core security and auth modules."""

from datetime import timedelta

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core import settings
from app.core.auth import ALGORITHM, ROLE_HIERARCHY, create_access_token, verify_token
from app.core.security import hash_password, verify_password


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def test_hash_password():
    """hash_password → verify_password returns True for the correct password."""
    hashed = hash_password("my_secret_123")
    assert verify_password("my_secret_123", hashed) is True


def test_verify_wrong_password():
    """verify_password returns False for the wrong password."""
    hashed = hash_password("correct_password")
    assert verify_password("wrong_password", hashed) is False


def test_different_hashes():
    """Same password produces different hashes (bcrypt salt)."""
    h1 = hash_password("same_password")
    h2 = hash_password("same_password")
    assert h1 != h2
    # Both should still verify
    assert verify_password("same_password", h1) is True
    assert verify_password("same_password", h2) is True


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------


def test_create_access_token():
    """create_access_token produces a decodable JWT with the correct sub claim."""
    token = create_access_token({"sub": "user-42", "workspace_id": "ws-1"})
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    assert payload["sub"] == "user-42"
    assert payload["workspace_id"] == "ws-1"
    assert "exp" in payload


def test_verify_valid_token():
    """verify_token successfully decodes a valid token."""
    token = create_access_token({"sub": "user-99"})
    payload = verify_token(token)
    assert payload["sub"] == "user-99"
    assert "exp" in payload


def test_verify_expired_token():
    """A token with negative expiry should be expired and raise 401."""
    token = create_access_token(
        {"sub": "user-old"},
        expires_delta=timedelta(seconds=-1),
    )
    # The token was created with exp in the past, so it is already expired
    with pytest.raises(HTTPException) as exc_info:
        verify_token(token)
    assert exc_info.value.status_code == 401


def test_verify_invalid_token():
    """A random string is not a valid JWT — raises 401."""
    with pytest.raises(HTTPException) as exc_info:
        verify_token("this-is-not-a-jwt-at-all")
    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Role hierarchy
# ---------------------------------------------------------------------------


def test_role_hierarchy():
    """ROLE_HIERARCHY orders display < viewer < editor < admin < owner."""
    assert ROLE_HIERARCHY["display"] < ROLE_HIERARCHY["viewer"]
    assert ROLE_HIERARCHY["viewer"] < ROLE_HIERARCHY["editor"]
    assert ROLE_HIERARCHY["editor"] < ROLE_HIERARCHY["admin"]
    assert ROLE_HIERARCHY["admin"] < ROLE_HIERARCHY["owner"]
