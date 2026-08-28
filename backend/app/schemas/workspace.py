from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str
    slug: str
    workspace_type: str = "family"
    timezone: str = "Europe/Stockholm"


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    logo: Optional[str] = None
    primary_color: Optional[str] = None
    timezone: Optional[str] = None
    settings: Optional[dict[str, Any]] = None


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    workspace_type: str
    logo: Optional[str] = None
    primary_color: Optional[str] = None
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
