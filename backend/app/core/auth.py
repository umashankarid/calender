from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.core.database import get_db

ALGORITHM = "HS256"

ROLE_HIERARCHY: dict[str, int] = {
    "display": 0,
    "viewer": 1,
    "editor": 2,
    "admin": 3,
    "owner": 4,
}

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Require a valid JWT Bearer token. Returns the decoded payload."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return verify_token(credentials.credentials)


async def require_display_or_auth(
    display_token: Optional[str] = Query(None, alias="token"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """Accept either a display token query parameter OR a JWT Bearer token."""
    if credentials is not None:
        return verify_token(credentials.credentials)
    if display_token is not None:
        return verify_token(display_token)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


async def get_current_user_workspace(
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Extract workspace_id and user_id from JWT, verify membership, return WorkspaceUser."""
    # Lazy import to avoid circular dependency with models
    from app.models.workspace import WorkspaceUser

    workspace_id = payload.get("workspace_id")
    user_id = payload.get("sub")

    if workspace_id is None or user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing workspace_id or sub claim",
        )

    result = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == user_id,
        )
    )
    workspace_user = result.scalar_one_or_none()
    if workspace_user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this workspace",
        )
    return workspace_user


def require_role(min_role: str):
    """Factory that returns a dependency checking the user has at least *min_role*.

    Role hierarchy (highest → lowest): owner > admin > editor > viewer > display
    """
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def _check_role(
        payload: dict = Depends(require_auth),
        db: AsyncSession = Depends(get_db),
    ):
        from app.models.workspace import WorkspaceUser

        workspace_id = payload.get("workspace_id")
        user_id = payload.get("sub")

        if workspace_id is None or user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing workspace_id or sub claim",
            )

        result = await db.execute(
            select(WorkspaceUser).where(
                WorkspaceUser.workspace_id == workspace_id,
                WorkspaceUser.user_id == user_id,
            )
        )
        workspace_user = result.scalar_one_or_none()
        if workspace_user is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not belong to this workspace",
            )

        user_level = ROLE_HIERARCHY.get(workspace_user.role, -1)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least '{min_role}' role",
            )
        return workspace_user

    return _check_role
