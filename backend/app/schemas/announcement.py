from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    body: Optional[str] = None
    priority: str = "normal"
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    priority: Optional[str] = None
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AnnouncementResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    body: Optional[str] = None
    priority: str
    is_active: bool
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
