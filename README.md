# Calendar Hub

A multi-tenant calendar management platform with workspace-based isolation, widget-driven displays, and three distinct interface modes.

## Architecture

### Multi-Tenant Workspaces

Every tenant operates within an isolated **workspace**, identified by a unique slug. Workspaces encapsulate all calendar data, display configurations, and user permissions, ensuring complete data separation between tenants.

### Interface Modes

Each workspace exposes three interface modes:

| Mode | Route | Purpose |
|---|---|---|
| **Interactive** | `/:slug` | Default view — browse calendars, filter events, interact with content |
| **Display** | `/:slug/display` | Read-only, auto-refreshing view optimised for wall-mounted screens and kiosks |
| **Admin** | `/:slug/admin` | Workspace management — calendars, widgets, users, settings |

### Widget-Based Displays

Display and interactive views are composed from configurable **widgets**:

- **Calendar grid** — month / week / day views
- **Event list** — upcoming events with filters
- **Countdown** — time remaining until a target event
- **Agenda** — compact daily schedule
- **Custom HTML** — free-form content blocks

Widgets are arranged in a responsive grid layout and configured per-workspace through the admin panel.

## Route Table

| Path | Mode | Description |
|---|---|---|
| `/:slug` | Interactive | Public-facing calendar interface |
| `/:slug/display` | Display | Kiosk / digital signage view |
| `/:slug/admin` | Admin | Workspace administration panel |

## Project Structure

```
calendar-hub/
├── docker-compose.yml        # Container orchestration
├── .env                      # Environment variables (not committed)
├── .env.example              # Environment template
├── .gitignore
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── config.py         # Settings & env loading
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── routers/          # API route handlers
│   │   ├── services/         # Business logic
│   │   └── db.py             # Database session
│   └── tests/
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    ├── public/
    └── src/
        ├── main.tsx          # React entry point
        ├── App.tsx           # Root component & routing
        ├── api/              # API client
        ├── components/       # Shared UI components
        ├── pages/
        │   ├── Interactive/  # /:slug
        │   ├── Display/      # /:slug/display
        │   └── Admin/        # /:slug/admin
        └── widgets/          # Widget components
```

## Development

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2+
- (Optional) Node.js 20+ and Python 3.12+ for running services outside containers

### Quick Start with Docker

```bash
# Clone the repository
git clone <repo-url> calendar-hub
cd calendar-hub

# Copy the environment template
cp .env.example .env

# Start all services
docker compose up --build

# Services will be available at:
#   Frontend  → http://localhost:3000
#   Backend   → http://localhost:8000
#   Database  → localhost:5432
```

### Local Development (without Docker)

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev    # Vite dev server on http://localhost:5173
```

### Environment Variables

See [`.env.example`](.env.example) for all required variables. Key settings:

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_USER` | Database user | `calendarhub` |
| `POSTGRES_PASSWORD` | Database password | `changeme` |
| `POSTGRES_DB` | Database name | `calendarhub` |
| `DB_PORT` | Exposed database port | `5432` |
| `SECRET_KEY` | Backend signing key | `dev-secret-change-in-production` |
| `API_PORT` | Backend port | `8000` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:5173,http://localhost:3000` |
| `VITE_API_URL` | API base URL for frontend | `http://localhost:8000` |
| `FRONTEND_PORT` | Frontend port | `3000` |

### Docker Commands

```bash
docker compose up -d          # Start in background
docker compose down            # Stop services
docker compose down -v         # Stop and remove volumes (resets DB)
docker compose logs -f backend # Follow backend logs
docker compose exec db psql -U calendarhub  # Connect to database
```

## License

TBD
