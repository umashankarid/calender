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


## Deploying on Coolify

### Prerequisites

- Coolify installed on your VPS (HostUp or similar)
- A domain pointed to your VPS (e.g. `yourdomain.se`)
- The repo pushed to GitHub: `https://github.com/umashankarid/calender.git`

### Step 1 — Create Project

1. Coolify dashboard → **Projects** → **+ Add**
2. Name: `Calendar Hub`

### Step 2 — Add Docker Compose Resource

1. Inside the project → **+ New Resource**
2. Type: **Docker Compose**
3. Source: **GitHub (Public)**
4. Repository: `https://github.com/umashankarid/calender.git`
5. Branch: `main`

### Step 3 — Set Environment Variables

Add these in the resource's **Environment Variables** tab:

```
POSTGRES_USER=calendarhub
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=calendarhub
SECRET_KEY=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
CORS_ORIGINS=https://calendar.yourdomain.se
VITE_API_URL=https://calendar-api.yourdomain.se
API_PORT=8000
FRONTEND_PORT=3000
```

### Step 4 — Configure Domains

In each service's settings:

| Service | Domain | Port |
|---------|--------|------|
| **frontend** | `calendar.yourdomain.se` | 3000 |
| **backend** | `calendar-api.yourdomain.se` | 8000 |
| **db** | *(none — internal only)* | — |

Coolify handles HTTPS via Let's Encrypt automatically.

### Step 5 — Deploy

Click **Deploy**. Coolify will:
1. Clone the repo
2. Build backend and frontend Docker images
3. Start PostgreSQL → wait for health check → start backend → start frontend

### Step 6 — First Use

1. Open `https://calendar.yourdomain.se`
2. Register your account
3. Create a workspace (e.g. "My Home", slug: `home`)
4. Go to `https://calendar.yourdomain.se/home/admin` → Displays → Register a display
5. On your tablet, open `https://calendar.yourdomain.se/home/display` and enter the pairing code

### Important Notes

- **VITE_API_URL** must be the **public** backend URL (with `https://`). It's baked into the frontend JS at build time.
- **CORS_ORIGINS** must include the frontend's public URL.
- The `pgdata` Docker volume persists database data across redeployments.
- To redeploy after code changes: push to GitHub, then click **Redeploy** in Coolify.

### DNS Setup

Create two A records pointing to your VPS IP:

```
calendar.yourdomain.se     → <VPS-IP>
calendar-api.yourdomain.se → <VPS-IP>
```

### Single Domain Alternative

If you prefer one domain, you can put both behind a reverse proxy:

```
calendar.yourdomain.se        → frontend (port 3000)
calendar.yourdomain.se/api/*  → backend (port 8000)
```

In that case, set `VITE_API_URL=https://calendar.yourdomain.se` and update the backend to serve under `/api`.
