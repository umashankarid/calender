from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ReminderCreate(BaseModel):
    event_id: UUID
    workspace_user_id: Optional[UUID] = None
    remind_at: datetime
    message: Optional[str] = None


class ReminderUpdate(BaseModel):
    remind_at: Optional[datetime] = None
    message: Optional[str] = None
    status: Optional[str] = None


class ReminderResponse(BaseModel):
    id: UUID
    event_id: UUID
    workspace_user_id: Optional[UUID] = None
    remind_at: datetime
    message: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
