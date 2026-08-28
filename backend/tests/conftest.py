"""Shared pytest fixtures for Calendar Hub backend tests."""

import uuid
import sqlite3
from collections.abc import AsyncGenerator
from typing import Callable

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import Uuid

# Import Base and get_db so we can override the dependency
from app.core.database import Base, get_db

# Import all models so they register on Base.metadata before create_all
import app.models  # noqa: F401

# Import helpers for creating tokens and hashing passwords
from app.core.auth import create_access_token
from app.core.security import hash_password


# ---------------------------------------------------------------------------
# SQLite UUID adapter — register once at module level
# ---------------------------------------------------------------------------

sqlite3.register_adapter(uuid.UUID, lambda u: str(u))

# Patch Uuid.bind_processor so string UUIDs are accepted alongside uuid.UUID
_orig_bp = Uuid.bind_processor


def _patched_bind_processor(self, dialect):
    orig_proc = _orig_bp(self, dialect)
    if orig_proc is None:
        return None

    def _safe_proc(value):
        if value is None:
            return None
        if isinstance(value, str):
            try:
                value = uuid.UUID(value)
            except ValueError:
                return value
        return orig_proc(value)

    return _safe_proc


Uuid.bind_processor = _patched_bind_processor  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Database fixtures — shared connection so test data is visible to API
# ---------------------------------------------------------------------------

@pytest.fixture()
async def _engine():
    """Create a SQLite in-memory engine with StaticPool (single connection)."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture()
async def db(_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide an AsyncSession bound to the test engine.
    
    Uses the same connection pool as the API (StaticPool ensures single connection).
    """
    session_factory = async_sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# FastAPI app + HTTPX client
# ---------------------------------------------------------------------------

@pytest.fixture()
async def app(_engine):
    """Return the FastAPI application with get_db overridden to use the test DB."""
    from app.main import app as _app

    session_factory = async_sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    _app.dependency_overrides[get_db] = _override_get_db
    yield _app
    _app.dependency_overrides.clear()


@pytest.fixture()
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Provide an httpx.AsyncClient wired to the test FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def auth_headers(user_id: uuid.UUID, workspace_id: uuid.UUID | None = None) -> dict[str, str]:
    """Create a JWT for *user_id* and return an Authorization header dict."""
    payload: dict = {"sub": str(user_id)}
    if workspace_id is not None:
        payload["workspace_id"] = str(workspace_id)
    token = create_access_token(payload)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Factory helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def create_test_user(db: AsyncSession) -> Callable:
    """Return an async factory that inserts a User and gives back (user, headers)."""
    from app.models.user import User

    async def _create(
        email: str = "test@example.com",
        name: str = "Test User",
        password: str = "password123",
    ) -> tuple:
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=name,
            password_hash=hash_password(password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        headers = auth_headers(user.id)
        return user, headers

    return _create


@pytest.fixture()
def create_test_workspace(db: AsyncSession) -> Callable:
    """Return an async factory that inserts a Workspace + owner WorkspaceUser."""
    from app.models.workspace import Workspace
    from app.models.workspace_user import WorkspaceUser

    async def _create(
        user_id: uuid.UUID,
        name: str = "Test Workspace",
        slug: str = "test-workspace",
    ):
        workspace = Workspace(
            id=uuid.uuid4(),
            name=name,
            slug=slug,
        )
        db.add(workspace)
        await db.flush()

        workspace_user = WorkspaceUser(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user_id,
            role="owner",
        )
        db.add(workspace_user)
        await db.commit()
        await db.refresh(workspace)
        return workspace

    return _create
