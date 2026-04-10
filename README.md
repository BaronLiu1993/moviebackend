# Movie Backend

A TypeScript + Express.js backend for a Korean drama discovery and rating platform. Users authenticate via Google OAuth, rate films, manage friendships, and receive personalized recommendations powered by OpenAI embeddings that evolve incrementally as users rate more content.

## Tech Stack

- **Runtime:** Node.js 22 + Express 5 + TypeScript (ESM)
- **Database:** Supabase (PostgreSQL + Auth + RPC)
- **Embeddings:** OpenAI `text-embedding-3-small` (384 dimensions)
- **Queues:** BullMQ + Redis (async embedding recomputation)
- **Analytics:** ClickHouse (direct inserts for event tracking)
- **ML:** Python (numpy for incremental vector math)
- **Validation:** Zod
- **External API:** TMDB (movie/TV metadata)

## Prerequisites

- Node.js 22+
- Python 3
- Docker & Docker Compose (for Redis + ClickHouse)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/baronliu1993/moviebackend.git
cd moviebackend
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your Supabase, OpenAI, TMDB, and ClickHouse credentials
```

### 3. Run full setup

```bash
make setup
```

This installs Node and Python dependencies, starts Redis and ClickHouse via Docker Compose, and initializes the ClickHouse schema.

### 4. Start development server

```bash
make dev
```

The server runs on `http://localhost:8000`.

## Scripts

| Command | Description |
| --- | --- |
| `make setup` | Install all deps, start containers, init ClickHouse |
| `make dev` | Start Redis + ClickHouse and dev server with hot reload |
| `make test` | Run Jest test suite |
| `make build` | Compile TypeScript to `dist/` |
| `npm run dev` | Dev server only (no containers) |
| `npm run build` | TypeScript compile |
| `npm start` | Run compiled `dist/index.js` |

## Project Structure

```
index.ts                  # Express app entry point (port 8000)
middleware/               # Auth (JWT) and validation middleware
router/                   # Route definitions by domain
  auth/                   #   OAuth sign-in, registration
  query/                  #   Feed, search, airing, popular
  rate/                   #   CRUD for ratings
  friend/                 #   Friend requests and profiles
  analytics/              #   Click, impression, like tracking
  bookmark/               #   Bookmark management
service/                  # Business logic by domain
schemas/                  # Zod validation schemas
queue/                    # BullMQ workers (embedding recomputation)
ranking/                  # Python ML scripts (embedding math)
clickhouse/               # ClickHouse schema definitions
tests/                    # Jest test suite
```

Each domain follows a **router -> service** pattern. Routers handle HTTP concerns; services contain business logic and database calls.

## API Endpoints

All routes are prefixed with `/v1/api`. Protected routes require a `Bearer` token in the `Authorization` header.

### Auth (`/v1/api/auth`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/signup-with-google` | No | Initiate Google OAuth flow |
| GET | `/oauth2callback` | No | OAuth callback, returns JWT tokens |
| POST | `/register` | Yes | Complete registration with preferences |

### Feed & Search (`/v1/api/query`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/initial-feed` | Yes | Personalized recommendations |
| GET | `/friend-search` | Yes | Search for friends |
| GET | `/airing` | No | Currently airing Korean dramas |
| GET | `/popular` | No | Popular Korean dramas |
| GET | `/ratings` | Yes | Get user's ratings with film details |

### Ratings (`/v1/api/rate`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/insert-ratings` | Yes | Rate a film (1-5) with note |
| GET | `/select-ratings` | Yes | Get user's ratings |
| PUT | `/update-ratings` | Yes | Update an existing rating |
| DELETE | `/delete-ratings` | Yes | Delete a rating |

### Friends (`/v1/api/friend`) -- all authenticated

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/send-request` | Yes | Send a friend request |
| POST | `/accept-request` | Yes | Accept a friend request |
| POST | `/decline-request` | Yes | Decline a friend request |
| GET | `/get-following` | Yes | List users you follow |
| GET | `/get-followers` | Yes | List your followers |
| GET | `/get-friend-requests` | Yes | List pending requests |
| GET | `/get-profile` | Yes | View a user's profile |

### Analytics (`/v1/api/analytics`) -- no auth

| Method | Route | Description |
| --- | --- | --- |
| POST | `/click` | Track a click event |
| POST | `/impression` | Track impressions |
| POST | `/like` | Track a like |
| POST | `/friend-like` | Track a friend-like |

### Bookmarks (`/v1/api/bookmark`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/add-bookmark` | Yes | Bookmark a film |
| DELETE | `/remove-bookmark` | Yes | Remove a bookmark |
| GET | `/get-bookmarks` | Yes | Get user's bookmarks |

### Health

`GET /health` -- returns `{ status: "ok" }`

## How Recommendations Work

Each user has three embedding vectors:

1. **Interest embedding** -- generated once at registration from genre/movie/mood preferences using OpenAI embeddings
2. **Behavioral embedding** -- evolves incrementally each time the user rates a film, weighted by rating value (1-5)
3. **Profile embedding** -- a blend of the two: `alpha * interest + (1 - alpha) * behavioral`, where `alpha = 1 / (1 + rating_count)`

New users get recommendations based on stated preferences. As they rate more content, the system gradually shifts toward behavior-driven recommendations. The behavioral embedding is updated via a Python subprocess that performs incremental vector math -- no full retraining needed.

## Environment Variables

See [.env.example](.env.example) for the full list:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE` | Supabase service role key (admin) |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `OPENAI_API_KEY` | OpenAI API key for embeddings |
| `TMDB_API_KEY` | TMDB API key for film metadata |
| `CLICKHOUSE_USER` | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | ClickHouse password |
| `CLICKHOUSE_DATABASE` | ClickHouse database name |
| `CORS_ORIGIN` | Allowed CORS origin |
| `CRON_ADMIN_TOKEN` | Admin token for cron endpoints |

## Docker

```bash
docker compose up --build
```

Starts the app, Redis, and ClickHouse.

```bash
docker compose down       # stop containers
docker compose down -v    # stop and remove persisted data
```

## License

ISC
