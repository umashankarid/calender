import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    String,
    Boolean,
    Text,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EventMember(Base):
    __tablename__ = "event_members"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), primary_key=True
    )
    workspace_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace_users.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending / accepted / declined
    accepted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workspace_users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    event: Mapped["Event"] = relationship(back_populates="member_links")
    workspace_user: Mapped["WorkspaceUser"] = relationship(
        foreign_keys=[workspace_user_id]
    )
    accepted_by: Mapped["WorkspaceUser | None"] = relationship(
        foreign_keys=[accepted_by_id]
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    calendar_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("calendars.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    all_day: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recurrence: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="calendarhub"
    )
    external_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
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
    workspace: Mapped["Workspace"] = relationship(back_populates="events")
    calendar: Mapped["Calendar | None"] = relationship(
        back_populates="events"
    )
    member_links: Mapped[list["EventMember"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
