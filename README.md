# Movie Backend API

TypeScript + Express.js backend for a social movie discovery and rating platform. Users authenticate via Google OAuth, rate films, manage friendships, and receive personalized recommendations powered by OpenAI embeddings.

## Tech Stack

- **Runtime**: Express.js v5 + TypeScript (Node.js 18+)
- **Database**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI `text-embedding-3-small` for profile embeddings
- **Queues**: BullMQ + Redis (async job processing)
- **Analytics**: Kafka + ClickHouse (event streaming)
- **External**: TMDB API (movie metadata)

## Architecture

```
moviebackend/
├── index.ts                              # Express app entry point (port 8000)
├── middleware/
│   └── verifyToken.ts                    # JWT auth middleware
│
├── router/                               # Route handlers
│   ├── auth/authRouter.ts                # Google OAuth + registration
│   ├── query/queryRouter.ts              # Film discovery + feed
│   ├── rate/rateRouter.ts                # Rating CRUD
│   ├── friend/friendRouter.ts            # Friend management
│   └── analytics/analyticsRouter.ts      # Event tracking
│
├── service/                              # Business logic
│   ├── auth/authService.ts               # OAuth, profile embedding generation
│   ├── query/queryService.ts             # Recommendations, TMDB integration
│   ├── rate/rateService.ts               # Rating operations
│   ├── friend/friendService.ts           # Friend requests, follows, profiles
│   ├── analytics/analyticsService.ts     # Kafka event producers
│   ├── kafka/                            # Kafka producer + consumer config
│   ├── clickhouse/clickhouseService.ts   # ClickHouse analytics writes
│   └── supabase/configureSupabase.ts     # Supabase client factory
│
├── queue/                                # Async job processing
│   ├── redis/redis.ts                    # Redis connection
│   ├── training/                         # Model training queue (WIP)
│   └── updateEmbedding/                  # Embedding update queue (WIP)
│
└── ranking/                              # ML training pipeline (Python)
    ├── training/train.py                 # LightGBM model training
    ├── reasoner/model.py                 # Model inference
    └── aggregate/aggregate.py            # Data aggregation
```

Each domain follows a **router → service** pattern. Routers handle HTTP concerns; services contain business logic and database calls.

## API Endpoints

### Auth (`/v1/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/signup-with-google` | Initiate Google OAuth flow |
| GET | `/oauth2callback` | OAuth callback, returns JWT tokens |
| POST | `/register` | Complete profile with genres + movies (generates embedding) |

### Discovery (`/v1/api/query`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/initial-feed?userId=` | No | Personalized feed (embeddings + popular + airing) |
| GET | `/friend-search` | Yes | Films bookmarked by friends |
| GET | `/airing` | No | Currently airing Korean dramas |
| GET | `/popular` | No | Popular Korean dramas |

### Ratings (`/v1/api/rate`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/insert-ratings` | Add rating (1-5) with optional note |
| GET | `/select-ratings` | Get user's ratings |
| PUT | `/update-ratings` | Update a rating |
| DELETE | `/delete-ratings` | Remove a rating |

### Friends (`/v1/api/friend`) — all authenticated
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send-request` | Send friend request |
| POST | `/accept-request` | Accept request |
| POST | `/decline-request` | Reject request |
| GET | `/get-following` | Users you follow |
| GET | `/get-followers` | Pending incoming requests |
| GET | `/get-profile?friendId=` | View friend's profile (friends only) |

### Analytics (`/v1/api/analytics`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/click` | Log film click |
| POST | `/impression` | Log view impression |
| POST | `/like` | Log explicit like |
| POST | `/friend-like` | Log friend activity like |

### Health
`GET /health` — returns `{ status: "ok" }`

## Getting Started

### Prerequisites
Node.js 18+, Redis, Supabase project, OpenAI API key, TMDB API key

### Setup

```bash
npm install
cp .env.example .env   # configure your keys
npm run dev             # starts on http://localhost:8000
```

### Environment Variables

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_JWT_ALGORITHM=HS256
SUPABASE_SERVICE_ROLE=

OPENAI_API_KEY=
TMDB_API_KEY=
TMDB_API_BASE=https://api.themoviedb.org/

KAFKA_BROKER_URL=localhost:9092
CLICKHOUSE_URL=http://localhost:8123/
CLICKHOUSE_USER=
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=

REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

### Docker

Ensure you have a `.env` file configured (see above), then:

```bash
docker compose up --build
```

This starts all services:

| Service    | Port(s)      |
|------------|--------------|
| App        | 8000         |
| Kafka      | 9092         |
| Redis      | 6379         |
| ClickHouse | 8123, 9000   |

To stop:

```bash
docker compose down
```

To stop and remove persisted data (Redis, ClickHouse):

```bash
docker compose down -v
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled `dist/index.js` |