"""API router — aggregates all sub-routers under /api."""

from fastapi import APIRouter

from app.api.announcements import router as announcements_router
from app.api.auth import router as auth_router
from app.api.calendars import router as calendars_router
from app.api.displays import router as displays_router
from app.api.events import router as events_router
from app.api.members import router as members_router
from app.api.reminders import router as reminders_router
from app.api.voice import router as voice_router
from app.api.workspaces import router as workspaces_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(workspaces_router)
api_router.include_router(members_router)
api_router.include_router(calendars_router)
api_router.include_router(events_router)
api_router.include_router(reminders_router)
api_router.include_router(announcements_router)
api_router.include_router(displays_router)
api_router.include_router(voice_router)
