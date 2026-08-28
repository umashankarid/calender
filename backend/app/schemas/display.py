from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class DisplayCreate(BaseModel):
    name: str


class DisplayUpdate(BaseModel):
    name: Optional[str] = None
    layout: Optional[dict[str, Any]] = None


class DisplayResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    token: str
    pairing_code: Optional[str] = None
    is_paired: bool
    layout: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DisplayWidgetCreate(BaseModel):
    widget_type: str
    position: int
    config: Optional[dict[str, Any]] = None
    is_visible: bool = True


class DisplayWidgetResponse(BaseModel):
    id: UUID
    display_id: UUID
    widget_type: str
    position: int
    config: Optional[dict[str, Any]] = None
    is_visible: bool
    created_at: datetime

    model_config = {"from_attributes": True}
