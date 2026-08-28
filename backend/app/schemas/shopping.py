from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ShoppingItemCreate(BaseModel):
    name: str
    quantity: Optional[str] = None
    category: Optional[str] = None


class ShoppingItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[str] = None
    category: Optional[str] = None
    is_bought: Optional[bool] = None


class ShoppingItemResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    quantity: Optional[str] = None
    category: Optional[str] = None
    is_bought: bool
    added_by_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
