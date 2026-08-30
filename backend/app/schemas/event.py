from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.workspace_user import WorkspaceUserResponse


class EventCreate(BaseModel):
    title: str
    start: datetime
    end: Optional[datetime] = None
    all_day: bool = False
    location: Optional[str] = None
    notes: Optional[str] = None
    recurrence: Optional[str] = None  # "daily", "weekly", "monthly"
    repeat_count: Optional[int] = None  # e.g. 10 times
    repeat_until: Optional[datetime] = None  # e.g. 2026-12-31
    calendar_id: Optional[UUID] = None
    member_ids: list[UUID] = Field(default_factory=list)


class EventUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    recurrence: Optional[str] = None
    calendar_id: Optional[UUID] = None
    member_ids: Optional[list[UUID]] = None


class EventResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    calendar_id: Optional[UUID] = None
    title: str
    start: datetime
    end: Optional[datetime] = None
    all_day: bool
    location: Optional[str] = None
    notes: Optional[str] = None
    recurrence: Optional[str] = None
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EventWithMembers(EventResponse):
    members: list[WorkspaceUserResponse] = Field(default_factory=list)
