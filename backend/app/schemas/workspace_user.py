from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserResponse


class WorkspaceUserCreate(BaseModel):
    email: str
    role: str = "viewer"
    display_name: Optional[str] = None
    display_color: Optional[str] = None


class WorkspaceUserUpdate(BaseModel):
    role: Optional[str] = None
    display_name: Optional[str] = None
    display_color: Optional[str] = None


class WorkspaceUserResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID
    role: str
    display_name: Optional[str] = None
    display_color: Optional[str] = None
    created_at: datetime
    user: UserResponse

    model_config = {"from_attributes": True}
