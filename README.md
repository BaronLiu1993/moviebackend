# Movie Backend API

A comprehensive TypeScript-based Express.js backend for a social movie discovery and rating platform. The application enables users to authenticate via Google OAuth, manage friendships, search for films using AI-powered embeddings, maintain personalized movie ratings, and receive intelligent personalized feeds powered by embeddings and analytics.

## Overview

This is a full-featured REST API built with Express.js that integrates with Supabase (PostgreSQL database + authentication), OpenAI for semantic embeddings, and Redis-based queues. The system uses asynchronous job processing for ratings and analytics-driven recommendation optimization.

## Key Features

### Authentication & User Management
- **Google OAuth 2.0 Integration** via Supabase Auth
- JWT token-based authentication for protected endpoints
- User profile registration with interest-based embeddings
- Token verification middleware for secure API access

### 👥 Social Features
- **Friend Management**: Send, accept, and reject friend requests
- **Follower/Following System**: Track user relationships
- **Secure Profile Access**: Only accepted friends can view profiles
- **User Discovery**: Search and connect with other users

### 🎬 Movie Discovery & Personalized Feed
- **Intelligent Home Feed**: Dynamic recommendations based on user segment (cold-start, active, power user)
- **Cursor-Based Pagination**: Efficient feed pagination with cursor tokens
- **Multi-Source Ranking**: Combines personalized, friends, and trending content
- **Semantic Similarity Search**: Find films similar to text queries using OpenAI embeddings
- **Friend-Based Recommendations**: Discover movies bookmarked by friends
- **Advanced Filtering**: Query for currently airing Korean dramas and popular titles
- **Taste-Based Recommendations**: Similar films to ones user liked

### Rating & Review System
- **Movie Ratings**: Users can rate films (1-5 stars) with matrix factorization embeddings
- **Personal Notes**: Add text reviews/notes with ratings
- **Async Processing**: Queue-based system for handling rating operations
- **Embedding Updates**: Automatic user embedding updates on rating changes
- **Rating Management**: View, update, and delete user ratings

### Real-Time Analytics
- **Event Tracking**: Click and impression logging for metrics
- **CTR Metrics**: Track click-through rates by recommendation source
- **User Segmentation**: Automatic user classification (power, active, cold-start)
- **Embedding Quality Monitoring**: Measure prediction accuracy
- **Performance Dashboards**: Monitor recommendation quality metrics

### Performance & Reliability
- **Rate Limiting**: Global request rate limiting (200 requests per minute)
- **CORS Support**: Configurable cross-origin resource sharing
- **Redis Queues**: BullMQ for asynchronous job processing
- **Health Checks**: Built-in health monitoring endpoint

## Project Architecture

```
moviebackend/
├── index.ts                          # Main Express app setup
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript configuration
│
├── middleware/
│   └── verifyToken.ts               # JWT verification middleware
│
├── router/                           # API route handlers
│   ├── auth/authRouter.ts           # Authentication endpoints
│   ├── query/queryRouter.ts         # Film search & discovery
│   ├── rate/rateRouter.ts           # Rating management
│   ├── friend/friendRouter.ts       # Friend & social features
│   └── feed/feedRouter.ts           # Personalized feed
│
├── service/                          # Business logic layer
│   ├── auth/authService.ts          # Auth & profile logic
│   ├── query/queryService.ts        # Search & recommendation logic
│   ├── rate/rateService.ts          # Rating operations & analytics
│   ├── feed/feedService.ts          # Feed ranking & aggregation
│   └── supabase/configureSupabase.ts # Supabase client setup
│
├── queue/                            # Asynchronous job processing
│   ├── redis/redis.ts               # Redis connection config
│   ├── insertRate/                  # Insert rating job queue
│   │   ├── insertRateQueue.ts
│   │   └── insertRateWorker.ts
│   └── deleteRate/                  # Delete rating job queue
│       ├── deleteRateQueue.ts
│       └── deleteRateWorker.ts
│
└── docs/
    └── README.md                    # Project documentation
```

## Technology Stack

### Core Framework
- **Express.js** (v5.2.1): HTTP server framework
- **TypeScript** (v5.9.2): Type-safe JavaScript

### Authentication & Database
- **Supabase**: PostgreSQL database + Auth service
- **JWT (jsonwebtoken)**: Token-based authentication
- **@supabase/supabase-js**: Supabase client library

### AI & Search
- **OpenAI API**: Semantic embedding generation for similarity search
- **Vector Embeddings**: Text-embedding-3-small model for semantic similarity

### Async Processing & Caching
- **BullMQ** (v5.66.5): Redis-based job queue
- **ioredis** (v5.9.1): Redis client
- **Redis**: In-memory data store for queues and caching

### External APIs
- **TMDB API**: Movie metadata and discovery data

### Middleware & Utilities
- **CORS**: Cross-origin resource sharing
- **body-parser**: Request body parsing
- **cookie-parser**: Cookie handling
- **express-rate-limit**: Rate limiting
- **dotenv**: Environment configuration

## API Endpoints

### Authentication (`/v1/api/auth`)
| Method | Endpoint | Description | Returns |
|--------|----------|-------------|---------|
| GET | `/signup-with-google` | Initiates Google OAuth flow | Redirect URL |
| GET | `/oauth2callback` | OAuth callback handler | JWT tokens |
| POST | `/register` | Complete user profile registration | 204 No Content |

### Feed (`/v1/api/feed`)
| Method | Endpoint | Description | Returns |
|--------|----------|-------------|---------|
| GET | `/home?limit=20&cursor=<token>` | Personalized home feed | Feed items with cursor |

### Movie Discovery & Search (`/v1/api/query`)
| Method | Endpoint | Description | Returns |
|--------|----------|-------------|---------|
| GET | `/recommendations?offset=0` | AI recommendations based on user profile | Films array |
| GET | `/recommend-by-taste/:filmId?offset=0` | Films similar to a liked film | Films array |
| GET | `/similarity-search?query=<text>` | Semantic search by text query | Films array |
| GET | `/friend-search` | Movies bookmarked by friends | Films array |
| GET | `/keyword-search?genres=...&countries=...&fromYear=...&toYear=...` | Advanced filtering | Films array |
| GET | `/korean/airing` | Currently airing Korean dramas | Films array |
| GET | `/korean/popular` | Popular Korean dramas | Films array |

### Ratings (`/v1/api/rate`)
| Method | Endpoint | Description | Returns | Status |
|--------|----------|-------------|---------|--------|
| POST | `/insert-ratings` | Add a movie rating & review | None | 201 |
| GET | `/select-ratings` | Retrieve user's ratings | Ratings array | 200 |
| PUT | `/update-ratings` | Update a rating | None | 204 |
| DELETE | `/delete-ratings` | Remove a rating | None | 204 |
| POST | `/log-click` | Log film click event | None | 204 |
| POST | `/log-impression` | Log recommendation impression | None | 204 |

### Social Features (`/v1/api/friend`)
| Method | Endpoint | Description | Returns | Status |
|--------|----------|-------------|---------|--------|
| POST | `/send-request` | Send friend request | None | 201 |
| POST | `/accept-request` | Accept friend request | None | 201 |
| POST | `/decline-request` | Reject friend request | None | 204 |
| GET | `/followers` | Get user's followers | Users array | 200 |
| GET | `/following` | Get users being followed | Users array | 200 |
| GET | `/profile` | Get user profile (friends only) | User object | 200 |

### Health Check
| Method | Endpoint | Description | Returns |
|--------|----------|-------------|---------|
| GET | `/health` | API health status | `{ status: "ok" }` |

## Environment Variables

Create a `.env` file with the following configuration:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_JWT_ALGORITHM=HS256

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# TMDB Configuration
TMDB_API_BASE=https://api.themoviedb.org
TMDB_API_KEY=your_tmdb_key

# Redis Configuration (optional - defaults to localhost:6379)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Kafka Configuration (for analytics events)
# Kafka Configuration (for analytics events)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=moviebackend-client
KAFKA_TOPICS_EVENTS=recommendation_events

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Environment
NODE_ENV=development
PORT=8000
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Redis server running (for async job processing)
- Supabase account and project
- OpenAI API key
- TMDB API key

### Installation

```bash
# Clone the repository
git clone <repository_url>
cd moviebackend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your values
```

### Local Development Setup

```bash
# Start Redis (required for job queues)
redis-server

# Start development server with hot reload
npm run dev

# Server runs at http://localhost:8000
# Health check: GET http://localhost:8000/health
```

### Production Deployment

See [DOCKER.md](DOCKER.md) for complete Docker deployment guide including:
- Multi-stage build optimization
- Production health checks
- Docker Compose for local development
- Docker Hub deployment instructions

### Database Setup

Create required Supabase tables:

```sql
-- User ratings table
CREATE TABLE "Ratings" (
  rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User_Profiles"(user_id) ON DELETE CASCADE,
  film_id INT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Film embeddings table
CREATE TABLE "Film" (
  film_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INT UNIQUE,
  title TEXT,
  release_year TEXT,
  film_embedding VECTOR(1536),
  tags TEXT[]
);

-- Analytics events table
CREATE TABLE "Recommendation_Events" (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User_Profiles"(user_id) ON DELETE CASCADE,
  film_id INT,
  event_type TEXT CHECK (event_type IN ('click', 'impression', 'view', 'dismiss')),
  recommendation_source TEXT,
  film_count INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User metrics tables
CREATE TABLE "User_Metrics_Segments" (
  user_id UUID PRIMARY KEY,
  user_segment TEXT,
  embedding_quality_score FLOAT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Architecture Patterns

### Middleware-Based Authentication
The `verifyToken` middleware extracts JWT tokens from request headers, validates them against the Supabase JWT secret, and attaches a Supabase client instance to the request object. This allows authenticated endpoints to interact with the database securely.

### Service Layer Pattern
Business logic is separated from route handlers through the `service/` directory. Each domain (auth, query, rate, feed) has dedicated service functions that handle database operations, OpenAI API calls, and complex business logic.

### Feed Ranking & Aggregation
The feed service implements intelligent ranking:
- **Cold-start users**: Trending + exploration recommendations
- **Active users**: 60% personalized + 40% trending
- **Power users**: 50% personalized + 30% friends + 20% trending
- Cursor-based pagination for efficient large dataset handling
- Relevance scoring and duplicate removal

### Embedding-Based Recommendations
- User profiles: Interest-based embeddings from registration
- Films: Content-based embeddings from TMDB metadata
- Ratings: Matrix factorization with embedding updates
- Similarity: Cosine distance between user and film embeddings

### Async Job Queues
Rating operations (insert/update/delete) are processed asynchronously through Redis-based BullMQ queues. This prevents blocking request-response cycles, allows for retry logic, and enables embedding recalculation.

### Real-Time Analytics via Kafka
- Click and impression events streamed to Kafka
- Events processed for CTR calculation and user segmentation
- Metrics fed back into recommendation engine
- Data exported to data lake for Spark batch processing

### Rate Limiting
Global rate limiting (200 requests per minute) is applied to all routes to prevent abuse. Can be customized per-route if needed.

## Key Workflows

### User Registration & Profile Generation
1. User initiates Google OAuth via `/signup-with-google`
2. Redirected to Google consent screen
3. Google redirects to `/oauth2callback` with authorization code
4. Backend exchanges code for Supabase session
5. User profile created in database
6. Interest genres + movies → text embedding via OpenAI
7. Embedding stored in `User_Profiles.profile_embedding`
8. JWT token issued for subsequent requests

### Personalized Feed Generation
1. User requests `/feed/home?limit=20`
2. System fetches user segment from metrics table
3. Based on segment:
   - **Cold-start**: Fetch trending + explore films
   - **Active**: Mix personalized (60%) + trending (40%)
   - **Power**: Mix personalized (50%) + friends (30%) + trending (20%)
4. Results ranked by relevance score
5. Duplicates removed
6. Cursor-based next page token generated
7. Impression event logged for analytics

### Movie Search via Embeddings
1. User submits text query via `/similarity-search?query=<text>`
2. Query converted to embeddings via OpenAI API
3. Vector similarity search against `Film.film_embedding`
4. Results ranked by cosine distance
5. Matching films returned with similarity scores

### Rating & Embedding Update
1. User submits rating via POST `/insert-ratings`
2. Request added to BullMQ insertion queue
3. Worker process:
   - Persists rating to Supabase
   - Fetches user embedding and film embedding
   - Computes prediction error using dot product
   - Updates user embedding via gradient descent
4. Metrics updated asynchronously

## Analytics Pipeline

### Event Collection
- Click and impression events logged for analytics
- Events stored in Supabase for metrics calculation
- Metrics used to optimize recommendations

## Infrastructure & Deployment

See [DOCKER.md](DOCKER.md) for complete Docker deployment setup including:
- Multi-stage build optimization
- Production health checks
- Docker Compose for local development
- Docker Hub deployment instructions

## Error Handling

The API returns standardized JSON error responses:

```json
{
  "message": "Error description"
}
```

HTTP Status Codes:
- **200**: Successful GET request
- **201**: Resource created (POST)
- **204**: Successful operation with no content (PUT, DELETE)
- **400**: Bad request (missing/invalid inputs)
- **401**: Unauthorized (missing/invalid token)
- **404**: Resource not found
- **409**: Conflict (e.g., duplicate friend request)
- **500**: Internal server error

## Rate Limiting

- **Window**: 1 minute
- **Max Requests**: 200 per window
- **Headers**: Standard rate limit headers included in responses
  - `X-RateLimit-Limit`: 200
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Testing Recommendations

### Manual Testing with cURL

```bash
# 1. OAuth signup (redirects to Google)
curl -X GET http://localhost:8000/v1/api/auth/signup-with-google

# 2. Register profile (after OAuth)
curl -X POST http://localhost:8000/v1/api/auth/register \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "genres": "Action, Drama",
    "movies": "Breaking Bad, Inception",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }'

# 3. Get personalized feed
curl -X GET "http://localhost:8000/v1/api/feed/home?limit=20" \
  -H "Authorization: Bearer <your_jwt_token>"

# 4. Add rating
curl -X POST http://localhost:8000/v1/api/rate/insert-ratings \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "filmId": 550,
    "rating": 5,
    "note": "Amazing movie!"
  }'

# 5. Log click event for analytics
curl -X POST http://localhost:8000/v1/api/rate/log-click \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{ "filmId": 550 }'

# 6. Search by text embeddings
curl -X GET "http://localhost:8000/v1/api/query/similarity-search?query=sci-fi%20action%20movie" \
  -H "Authorization: Bearer <your_jwt_token>"

# 7. Get personalized recommendations with pagination
curl -X GET "http://localhost:8000/v1/api/query/recommendations?userId=550e8400-e29b-41d4-a716-446655440000&offset=0" \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Health & Status Checks

```bash
# Check API health
curl http://localhost:8000/health

# View process logs
npm run dev  # Development
pm2 logs moviebackend  # Production (if using PM2)

# Check Redis queue status
redis-cli info stats
```

## Performance Metrics & Monitoring

### Key Metrics to Track
- **Feed latency**: Target < 200ms for /feed/home
- **Search latency**: Target < 500ms for similarity search  
- **CTR by source**: Target > 12% overall, > 15% for personalized
- **User retention**: Target > 60% week-over-week
- **Embedding quality (MAE)**: Target < 0.3
- **Recommendation conversion**: Target > 5% rating rate
- **API uptime**: Target 99.9%

### Monitoring Kafka Events

```bash
# List topics
kafka-topics --bootstrap-servers localhost:9092 --list

# Monitor recommendation events in real-time
kafka-console-consumer --bootstrap-servers localhost:9092 \
  --topic recommendation_events --from-beginning

# Monitor lag
kafka-consumer-groups --bootstrap-servers localhost:9092 \
  --group moviebackend-consumer --describe
```

## Analytics Pipeline

For detailed analytics setup, see the separate analytics guide:
- Event collection via Kafka
- Real-time CTR calculation
- User segmentation and cohort analysis
- Embedding quality monitoring
- Spark job examples for batch processing
- Data lake integration

## Documentation

- [DOCKER.md](DOCKER.md) - Complete Docker deployment guide
- [API Endpoints](#api-endpoints) - Full endpoint reference with examples
- [Testing Guide](#testing-recommendations) - Manual testing with curl commands

## Troubleshooting

### Common Issues

**App won't start**
```bash
# Check Node version
node --version  # Should be v18+

# Verify environment variables
cat .env | grep SUPABASE_URL

# Test Redis connection
redis-cli ping  # Should return PONG

# Check port availability
lsof -i :8000
```

## License

MIT

## Support

For issues and questions:
1. Review the README and documentation
2. Check [DOCKER.md](DOCKER.md) for deployment issues
3. View application logs: `docker logs moviebackend`
4. Verify all environment variables are set
5. Test health endpoint: `curl http://localhost:8000/health`

**Last Updated**: February 7, 2026  
**Version**: 2.0.0  
**Status**: Production Ready with Analytics & Feed  
**Deploy**: Docker or Docker Compose
