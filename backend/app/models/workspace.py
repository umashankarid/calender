import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    workspace_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="family"
    )
    logo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_color: Mapped[str] = mapped_column(
        String(7), nullable=False, default="#3B82F6"
    )
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Europe/Stockholm"
    )
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    users: Mapped[list["WorkspaceUser"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    calendars: Mapped[list["Calendar"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    events: Mapped[list["Event"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    displays: Mapped[list["Display"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
    announcements: Mapped[list["Announcement"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
