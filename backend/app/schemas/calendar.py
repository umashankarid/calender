from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CalendarCreate(BaseModel):
    name: str
    color: str = "#3B82F6"
    is_default: bool = False


class CalendarUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class CalendarResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    color: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
