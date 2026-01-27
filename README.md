# GameHeros - Multi-Sport Scoring Platform

A simplified monolithic Go application for managing tournaments, live scoring, and viewing scores across multiple sports.

## Backend Setup

### Prerequisites
- Go 1.21+
- PostgreSQL 15+ (or Docker Compose)

### Installation

1. **Start PostgreSQL:**
```bash
docker compose up -d
```

2. **Run Database Migrations:**
```bash
docker exec -i gameheros_postgres psql -U postgres -d gameheros < "db schema/schema.sql"
```

3. **Install Dependencies:**
```bash
go mod download
```

4. **Run the Server:**

   **Option 1: Manual restart (for production)**
   ```bash
   go run main.go
   ```

   **Option 2: Auto-reload during development (recommended)**
   ```bash
   # Install air (one-time)
   go install github.com/cosmtrek/air@latest
   
   # Run with auto-reload
   air
   ```
   
   With `air`, the server automatically restarts when you save code changes. The `.air.toml` config file is already included.

Server runs on `http://localhost:8080`

## Frontend Setup

See `frontend/README.md` for detailed instructions.

## Project Structure

```
.
├── main.go                    # Application entry point
├── internal/
│   ├── config/               # Configuration management
│   ├── db/                   # Database connection (sqlx)
│   ├── models/               # Data models and DTOs
│   ├── handlers/             # HTTP handlers (Gin)
│   ├── router/               # Route setup
│   └── middleware/           # CORS, error handling
├── db schema/                # Database migrations
├── frontend/                 # React frontend
└── docker-compose.yml        # PostgreSQL setup
```

## Tech Stack

**Backend:**
- Gin (HTTP framework)
- sqlx (SQL extensions)
- PostgreSQL
- UUID for IDs

**Frontend:**
- React + TypeScript
- Vite
- Tailwind CSS
- React Query

## Development Notes

### Backend
The backend is set up with a **minimal foundation** using:
- **Gin** framework for HTTP routing
- **sqlx** for database operations (better than raw sql.DB)
- **validator** for request validation
- **UUID** for distributed ID generation

One example handler (`CreateTournament`) is provided to show the pattern. Implement the rest following the same structure. The handlers are stubbed with `TODO` comments.

### Frontend
A **complete, polished React frontend** is provided with:
- All pages implemented (Dashboard, Tournaments, Teams, Matches, Live Scoring)
- Modern UI with Tailwind CSS
- Real-time polling for live scores
- Type-safe API client
- Responsive design

You can focus on learning distributed programming concepts in the backend without worrying about frontend implementation.
