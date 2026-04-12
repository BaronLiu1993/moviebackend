# Movie Backend

A TypeScript + Express.js backend for a Korean drama discovery and rating platform. Users authenticate via Google OAuth, rate films, manage friendships, share collaborative lists, and receive personalized recommendations powered by OpenAI embeddings that evolve incrementally as users rate more content.

## Tech Stack

- **Runtime:** Node.js 22 + Express 5 + TypeScript (ESM)
- **Database:** Supabase (PostgreSQL + Auth + RPC + Storage)
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dimensions)
- **Queues:** BullMQ + Redis (async embedding recomputation, scraping)
- **Analytics:** ClickHouse (direct inserts for event tracking)
- **Search:** Hybrid keyword (PostgreSQL FTS) + semantic (pgvector) with RRF fusion
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
middleware/               # Auth (JWT, admin token) and validation middleware
router/                   # Route definitions by domain
  auth/                   #   Signup, login, registration, user profile
  feed/                   #   Personalized feed, hybrid search, impressions
  rate/                   #   CRUD for ratings, film likes, rating likes
  friend/                 #   Friend requests, profiles, social feed, invite links
  list/                   #   Collaborative lists with invite system
  admin/                  #   Admin-only ETL trigger
  bookmark/               #   Bookmark management
service/                  # Business logic by domain
  search/                 #   Hybrid keyword + semantic search with RRF
  storage/                #   Signed URL generation for private images
schemas/                  # Zod validation schemas
etl/                      # TMDB scraping + embedding pipeline
queue/                    # BullMQ workers (embedding, impressions, scraping)
ranking/                  # Python ML scripts (embedding math)
clickhouse/               # ClickHouse schema definitions
tests/                    # Jest test suite (11 suites, 100+ tests)
infra/                    # Terraform (DigitalOcean droplet + firewall)
```

## API Endpoints

All routes are prefixed with `/v1/api`. Protected routes require a `Bearer` token in the `Authorization` header.

### Auth (`/v1/api/auth`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/signup` | No | Create account with email/password |
| POST | `/login` | No | Login, returns JWT tokens |
| PUT | `/register` | Yes | Complete registration with preferences |
| GET | `/me` | Yes | Get current user profile from token |

### Feed & Search (`/v1/api/feed`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/generate-feed` | Yes | Personalized feed (RRF: recommended + collaborative + popular + airing) |
| GET | `/search` | Yes | Hybrid search (keyword + semantic with RRF fusion) |
| POST | `/bulk-impressions` | Yes | Track feed impressions in bulk |

### Ratings (`/v1/api/rate`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/ratings` | Yes | Rate a film (1-5) with note, optional image upload |
| GET | `/ratings` | Yes | Get user's ratings (with signed image URLs) |
| PUT | `/ratings` | Yes | Update an existing rating |
| DELETE | `/ratings` | Yes | Delete a rating |
| POST | `/like` | Yes | Like a film (increments Guanghai like_count) |
| DELETE | `/like` | Yes | Unlike a film |
| POST | `/like-rating` | Yes | Like a friend's rating (friendship-gated) |
| DELETE | `/like-rating` | Yes | Unlike a rating |

### Friends (`/v1/api/friend`) -- all authenticated

| Method | Route | Description |
| --- | --- | --- |
| POST | `/send-request` | Send a friend request |
| POST | `/accept-request` | Accept a friend request |
| POST | `/decline-request` | Decline a friend request |
| DELETE | `/unfriend` | Remove a friendship |
| GET | `/following` | List accepted friends (paginated) |
| GET | `/followers` | List pending incoming requests (paginated) |
| GET | `/friend-requests` | List pending requests (paginated) |
| GET | `/profile` | View a friend's profile + ratings with like data |
| GET | `/feed` | Social feed: recent ratings from all friends (paginated) |
| POST | `/invite` | Generate shareable invite link (7-day expiry) |
| GET | `/invite` | List your active invite codes |
| POST | `/redeem-invite` | Redeem invite code (instant mutual friendship) |

### Lists (`/v1/api/list`) -- all authenticated

| Method | Route | Description |
| --- | --- | --- |
| POST | `/` | Create a list (optional image upload) |
| GET | `/` | Get user's lists (owned + collaborated, with signed image URLs) |
| DELETE | `/` | Delete a list (owner only) |
| PUT | `/` | Rename a list (owner only) |
| POST | `/items` | Add a film to a list |
| DELETE | `/items` | Remove a film from a list |
| GET | `/items` | Get list items (paginated) |
| POST | `/invite` | Generate shareable list invite link |
| POST | `/redeem-invite` | Redeem list invite (join as collaborator) |
| GET | `/invite` | List active invite codes for a list |
| DELETE | `/members` | Remove a member from a list |
| GET | `/members` | Get list members |

### Bookmarks (`/v1/api/bookmark`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/bookmarks` | Yes | Bookmark a film |
| GET | `/bookmarks` | Yes | Get user's bookmarks (paginated) |
| DELETE | `/bookmarks` | Yes | Remove a bookmark |

### Admin (`/v1/api/admin`)

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/scrape` | Admin | Trigger ETL scrape + embed pipeline |

### Health

`GET /health` -- returns `{ status: "ok" }`

## How Recommendations Work

Each user has three embedding vectors:

1. **Interest embedding** -- generated once at registration from genre/movie/mood preferences using OpenAI embeddings
2. **Behavioral embedding** -- evolves incrementally each time the user rates a film, weighted by rating value (1-5)
3. **Profile embedding** -- a blend of the two: `alpha * interest + (1 - alpha) * behavioral`, where `alpha = 1 / (1 + rating_count)`

The feed combines 4 sources via **Reciprocal Ranked Fusion (RRF)**:
- Recommended films (embedding similarity)
- Collaborative filtering (friends' high-rated films)
- Popular dramas (TMDB)
- Currently airing (TMDB)

Post-RRF genre diversity reranking ensures variety in the final results.

## How Search Works

`GET /v1/api/feed/search?q=romance+time+travel`

1. **Keyword search** fires immediately (PostgreSQL full-text search on title + overview via tsvector/GIN index)
2. **Semantic search** runs in parallel (embed query via OpenAI, then pgvector cosine similarity)
3. Results fused via RRF (equal weights, k=60)
4. Supports filters: `media_type`, `country`, `release_year`, `genre_ids`

## Environment Variables

See [.env.example](.env.example) for the full list:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE` | Supabase service role key (admin) |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `SUPABASE_JWT_ALGORITHM` | JWT algorithm (HS256) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings |
| `TMDB_API_KEY` | TMDB API key for film metadata |
| `TMDB_API_BASE` | TMDB API base URL |
| `CLICKHOUSE_USER` | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | ClickHouse password |
| `CLICKHOUSE_DATABASE` | ClickHouse database name |
| `CORS_ORIGIN` | Allowed CORS origin (no trailing slash) |
| `CRON_ADMIN_TOKEN` | Admin token for cron/ETL endpoints |

## Docker

```bash
docker compose up --build
```

Starts the app, Redis, ClickHouse, and Caddy reverse proxy.

```bash
docker compose down       # stop containers
docker compose down -v    # stop and remove persisted data
```

## License

ISC
