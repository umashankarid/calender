"""Shopping list routes: list, add, update, toggle, delete items."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ROLE_HIERARCHY, require_auth
from app.core.database import get_db
from app.models.shopping_item import ShoppingItem
from app.models.workspace import Workspace
from app.models.workspace_user import WorkspaceUser
from app.schemas.shopping import ShoppingItemCreate, ShoppingItemResponse, ShoppingItemUpdate

router = APIRouter(
    prefix="/workspaces/{slug}/shopping",
    tags=["shopping"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def get_workspace(slug: str, db: AsyncSession) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.slug == slug))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


async def get_workspace_member(
    workspace_id: uuid.UUID, user_id: str, db: AsyncSession
) -> WorkspaceUser:
    uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    result = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == uid,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace",
        )
    return member


def check_role(member: WorkspaceUser, min_role: str) -> None:
    min_level = ROLE_HIERARCHY.get(min_role, 0)
    user_level = ROLE_HIERARCHY.get(member.role, -1)
    if user_level < min_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires at least '{min_role}' role",
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[ShoppingItemResponse])
async def list_shopping_items(
    slug: str,
    is_bought: Optional[bool] = Query(None),
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List all shopping items. Optionally filter by is_bought."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    query = select(ShoppingItem).where(
        ShoppingItem.workspace_id == workspace.id,
    )
    if is_bought is not None:
        query = query.where(ShoppingItem.is_bought == is_bought)

    query = query.order_by(ShoppingItem.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ShoppingItemResponse, status_code=status.HTTP_201_CREATED)
async def add_shopping_item(
    slug: str,
    data: ShoppingItemCreate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Add an item to the shopping list (editor+ only)."""
    workspace = await get_workspace(slug, db)
    member = await get_workspace_member(workspace.id, payload["sub"], db)
    check_role(member, "editor")

    item = ShoppingItem(
        workspace_id=workspace.id,
        name=data.name,
        quantity=data.quantity,
        category=data.category,
        added_by_id=member.id,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=ShoppingItemResponse)
async def update_shopping_item(
    slug: str,
    item_id: uuid.UUID,
    data: ShoppingItemUpdate,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update a shopping item (name, quantity, category, is_bought)."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.workspace_id == workspace.id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.flush()
    await db.refresh(item)
    return item


@router.put("/{item_id}/toggle", response_model=ShoppingItemResponse)
async def toggle_shopping_item(
    slug: str,
    item_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Quick toggle is_bought (no body needed, just flips the boolean)."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.workspace_id == workspace.id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping item not found")

    item.is_bought = not item.is_bought
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/bought", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bought_items(
    slug: str,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Remove all bought items at once (cleanup)."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    await db.execute(
        delete(ShoppingItem).where(
            ShoppingItem.workspace_id == workspace.id,
            ShoppingItem.is_bought == True,  # noqa: E712
        )
    )
    await db.flush()


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopping_item(
    slug: str,
    item_id: uuid.UUID,
    payload: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Remove a single item permanently."""
    workspace = await get_workspace(slug, db)
    await get_workspace_member(workspace.id, payload["sub"], db)

    result = await db.execute(
        select(ShoppingItem).where(
            ShoppingItem.id == item_id,
            ShoppingItem.workspace_id == workspace.id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping item not found")

    await db.delete(item)
    await db.flush()
