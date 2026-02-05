# Movie Backend API

A comprehensive TypeScript-based Express.js backend for a social movie discovery and rating platform. The application enables users to authenticate via Google OAuth, manage friendships, search for films using AI-powered embeddings, and maintain personalized movie ratings and reviews.

## Overview

This is a full-featured REST API built with Express.js that integrates with Supabase (PostgreSQL database + authentication) and OpenAI for generating semantic embeddings. The system uses Redis-based job queues for asynchronous operations like rating insertions and deletions.

## Key Features

### 🔐 Authentication & User Management
- **Google OAuth 2.0 Integration** via Supabase Auth
- JWT token-based authentication for protected endpoints
- User profile registration with interest-based embeddings
- Token verification middleware for secure API access

### 👥 Social Features
- **Friend Management**: Send, accept, and reject friend requests
- **Follower/Following System**: Track user relationships
- **Secure Profile Access**: Only accepted friends can view profiles
- **User Discovery**: Search and connect with other users

### 🎬 Movie Discovery & Search
- **Semantic Similarity Search**: Find films similar to text queries using OpenAI embeddings
- **Friend-Based Recommendations**: Discover movies bookmarked by friends
- **Advanced Filtering**: Query for currently airing Korean dramas and popular titles
- **Related Films**: Get recommendations based on film relationships

### ⭐ Rating & Review System
- **Movie Ratings**: Users can rate films (1-5 stars)
- **Personal Notes**: Add text reviews/notes with ratings
- **Async Processing**: Queue-based system for handling rating operations
- **Rating Management**: View, update, and delete user ratings

### 🚀 Performance & Reliability
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
│   └── friend/friendRouter.ts       # Friend & social features
│
├── service/                          # Business logic layer
│   ├── auth/authService.ts          # Auth & profile logic
│   ├── query/queryService.ts        # Search & recommendation logic
│   ├── rate/rateService.ts          # Rating operations
│   └── supabase/configureSupabase.ts # Supabase client setup
│
└── queue/                            # Asynchronous job processing
    ├── redis/redis.ts               # Redis connection config
    ├── insertRate/                  # Insert rating job queue
    │   ├── insertRateQueue.ts
    │   └── insertRateWorker.ts
    └── deleteRate/                  # Delete rating job queue
        ├── deleteRateQueue.ts
        └── deleteRateWorker.ts
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

### Async Processing
- **BullMQ** (v5.66.5): Redis-based job queue
- **ioredis** (v5.9.1): Redis client

### Middleware & Utilities
- **CORS**: Cross-origin resource sharing
- **body-parser**: Request body parsing
- **cookie-parser**: Cookie handling
- **express-rate-limit**: Rate limiting
- **dotenv**: Environment configuration

## API Endpoints

### Authentication (`/v1/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/signup-with-google` | Initiates Google OAuth flow |
| GET | `/oauth2callback` | OAuth callback handler, registers user & generates embeddings |

### Movie Discovery (`/v1/api/query`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/similarity-search?query=<text>` | Find movies via semantic search |
| GET | `/friend-search` | Movies bookmarked by friends |
| GET | `/related-films` | Films related to a specific movie |
| GET | `/recommended-films` | AI-generated recommendations |
| GET | `/currently-airing` | Korean dramas currently airing |
| GET | `/popular` | Popular Korean dramas |

### Ratings (`/v1/api/rate`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/insert-ratings` | Add a movie rating & review |
| GET | `/select-ratings` | Retrieve user's ratings |
| DELETE | `/delete-ratings` | Remove a rating |

### Social Features (`/v1/api/friend`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send-request` | Send friend request |
| POST | `/accept-request` | Accept friend request |
| POST | `/decline-request` | Reject friend request |
| GET | `/followers` | Get user's followers |
| GET | `/following` | Get users being followed |
| GET | `/profile` | Get user profile (friends only) |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health status |

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

# Redis Configuration (optional - defaults to localhost:6379)
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Redis server running (for async job processing)
- Supabase account and project
- OpenAI API key

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

### Development

```bash
# Start development server with hot reload
npm run dev

# Server runs at http://localhost:3000 (or configured port)
# Health check: GET http://localhost:3000/health
```

### Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Architecture Patterns

### Middleware-Based Authentication
The `verifyToken` middleware extracts JWT tokens from request headers, validates them against the Supabase JWT secret, and attaches a Supabase client instance to the request object. This allows authenticated endpoints to interact with the database securely.

### Service Layer Pattern
Business logic is separated from route handlers through the `service/` directory. Each domain (auth, query, rate) has dedicated service functions that handle database operations, OpenAI API calls, and complex business logic.

### Async Job Queues
Rating operations (insert/delete) are processed asynchronously through Redis-based BullMQ queues. This prevents blocking request-response cycles and allows for retry logic and job monitoring.

### Rate Limiting
Global rate limiting (200 requests per minute) is applied to all routes to prevent abuse. Can be customized per-route if needed.

## Key Workflows

### User Registration
1. User initiates Google OAuth via `/signup-with-google`
2. Redirected to Google consent screen
3. Google redirects to `/oauth2callback` with authorization code
4. Backend exchanges code for Supabase session
5. User profile created in database
6. Interest profile vector generated via OpenAI embeddings
7. JWT token issued for subsequent requests

### Movie Search
1. User submits text query via `/similarity-search?query=<text>`
2. Query is converted to embeddings via OpenAI API
3. Semantic similarity search performed against film embeddings in Supabase
4. Matching films returned ranked by similarity score

### Rating Management
1. User submits rating via POST `/insert-ratings`
2. Request added to BullMQ insertion queue
3. Worker process persists rating to Supabase
4. User can view ratings via GET `/select-ratings`
5. Delete request queued similarly for async removal

## Error Handling

The API returns standardized JSON error responses:

```json
{
  "message": "Error description"
}
```

HTTP Status Codes:
- **200**: Successful operation
- **400**: Bad request (missing/invalid inputs)
- **401**: Unauthorized (missing/invalid token)
- **500**: Internal server error

## Rate Limiting

- **Window**: 1 minute
- **Max Requests**: 200 per window
- **Headers**: Standard rate limit headers included in responses

## Future Enhancements

- Webhook support for real-time notifications
- Advanced filtering and sorting options
- User preference learning
- Caching layer for popular queries
- Comprehensive test suite
- API documentation (Swagger/OpenAPI)
