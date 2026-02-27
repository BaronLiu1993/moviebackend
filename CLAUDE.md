# CLAUDE.md

## What This Project Is

A TypeScript + Express.js backend for a Korean drama discovery and rating platform. Users authenticate via Google OAuth (Supabase), rate films, manage friendships, and receive personalized recommendations powered by OpenAI embeddings that evolve incrementally as users rate more content.

## Tech Stack

- **Runtime:** Node.js 22 + Express 5 + TypeScript (ESM modules, `"type": "module"` in package.json)
- **Database:** Supabase (PostgreSQL + Auth + RPC functions)
- **Embeddings:** OpenAI `text-embedding-3-small` (384 dimensions)
- **Queues:** BullMQ + Redis (async embedding recomputation)
- **Analytics Pipeline:** Direct ClickHouse inserts (event tracking for interactions and impressions)
- **ML:** Python (numpy for incremental vector math, lightgbm/pandas installed but training is stub)
- **External API:** TMDB (movie/TV metadata)

## Project Structure

```
index.ts                                # Express app entry, port 8000
middleware/
  verifyToken.ts                        # JWT auth: extracts Bearer token, validates via Supabase, sets req.user/req.token/req.supabaseClient
  validateRating.ts                     # Two validators: validateInsertRating (checks tmdbId exists in Guanghai table), validateUpdateRating (checks rating belongs to user)
router/
  auth/authRouter.ts                    # GET /signup-with-google, GET /oauth2callback, POST /register
  query/queryRouter.ts                  # GET /initial-feed, GET /friend-search, GET /airing, GET /popular, GET /ratings
  rate/rateRouter.ts                    # POST /insert-ratings, GET /select-ratings, PUT /update-ratings, DELETE /delete-ratings
  friend/friendRouter.ts               # POST /send-request, POST /accept-request, POST /decline-request, GET /get-following, GET /get-followers, GET /get-friend-requests, GET /get-profile
  analytics/analyticsRouter.ts          # POST /click, POST /impression, POST /like, POST /friend-like (no auth on these)
  test/testRouter.ts                    # POST /signup, POST /login (email/password for testing)
service/
  auth/authService.ts                   # handleSignIn() for OAuth, registerUser() generates interest_embedding via OpenAI
  query/queryService.ts                 # getInitialFeed() calls RPC get_recommended + TMDB popular/airing, getFriendFilms() calls RPC get_friends_films
  rate/rateService.ts                   # insertRating/updateRating/deleteRating all enqueue embedding recomputation jobs
  friend/friendService.ts               # Friend request lifecycle, getProfile() checks friendship via RPC is_following
  analytics/analyticsService.ts         # handleClick/handleImpression/handleLike/handleRating -> direct ClickHouse inserts
  supabase/configureSupabase.ts         # Three client factories: createSupabaseClient(accessToken), createSignInSupabase() (PKCE OAuth), createServerSideSupabaseClient() (admin/service role)
  tmdb/tmdbService.ts                   # fetchTmdbOverview(tmdbId) tries TV endpoint first, falls back to Movie
  clickhouse/clickhouseService.ts       # insertInteractionEvents() / insertImpressionEvent() writes to ClickHouse tables
  bookmarkService/bookmarkService.ts    # bookmarkFilm/removeBookmark on "bookmarks" table
queue/
  redis/redis.ts                        # Redis connection with TLS support, exponential backoff retry
  updateEmbedding/
    updateEmbeddingQueue.ts             # BullMQ queue "embedding-sync", job type EmbeddingJobData { userId, accessToken, operation, tmdbId, rating, oldRating? }
    updateEmbeddingWorker.ts            # Fetches film+user embeddings, spawns Python subprocess, updates User_Profiles
  training/
    trainingQueue.ts                    # BullMQ queue "training-sync" (placeholder)
    trainingWorker.ts                   # Empty worker (not yet implemented)
ranking/
  compute/incremental_embedding.py      # Core ML: incremental_insert/delete/update + blend() for profile embedding
  training/train.py                     # Stub: imports lightgbm but train_model() is empty
  reasoner/model.py                     # Stub
  aggregate/aggregate.py                # Empty
```

## Database Tables (Supabase PostgreSQL)

- **User_Profiles**: `user_id`, `email`, `name`, `interest_embedding` (set once at registration), `behavioral_embedding` (evolves with ratings), `behavioral_weight_sum`, `profile_embedding` (blended), `rating_count`, `completed_registration`, `genres`, `movies`, `moods`, `disliked_genres`
- **Ratings**: `rating_id`, `user_id`, `film_id` (TMDB ID), `rating` (1-5), `note` (10-500 chars), `film_name`, `genre`, `created_at`. Unique constraint on (user_id, film_id)
- **Guanghai**: Film metadata with `tmdb_id` and `film_embedding` (pre-computed vectors)
- **Friends**: `request_id`, `user_id`, `friend_id`, `status` (pending | accepted)
- **bookmarks**: `user_id`, `film_id`
- **user_interactions** (ClickHouse): `user_id`, `film_id`, `film_name`, `film_genre[]`, `interaction_type`, `rating`

## Supabase RPC Functions

- `get_recommended(user_id, limit_count, offset_count)` — similarity search using profile_embedding
- `get_friends_films(user_id)` — films rated by user's friends
- `is_following(p_follower_id, p_following_id)` — checks accepted friendship

## Core Data Flow: Embedding System

This is the most complex part of the codebase. Three embedding types per user:

1. **interest_embedding** — Generated once during registration (`authService.ts:registerUser`). Builds a natural language profile string from genres/movies/moods/dislikes, fetches TMDB overviews for selected movies, sends to OpenAI `text-embedding-3-small`.

2. **behavioral_embedding** — Evolves incrementally every time a user rates, updates, or deletes a rating. Computed by Python (`ranking/compute/incremental_embedding.py`) via weighted average where each film's embedding is weighted by the user's rating (1-5).

3. **profile_embedding** — Blended result used for actual recommendations. Formula: `alpha = 1/(1 + rating_count)`, `profile = alpha * interest + (1 - alpha) * behavioral`. Starts as pure interest, gradually shifts toward behavioral as user rates more.

### Rating -> Embedding Update Flow

1. User rates a film via `POST /v1/api/rate/insert-ratings`
2. `rateService.ts:insertRating()` inserts into Ratings table, then enqueues a job on `updateEmbeddingQueue`
3. `updateEmbeddingWorker.ts` picks up the job:
   - Fetches film embedding from Guanghai table
   - Fetches user's current embeddings from User_Profiles
   - Spawns `python3 ranking/compute/incremental_embedding.py` via `execFile` (10s timeout)
   - Passes JSON via stdin, reads result from stdout
4. Python computes new behavioral embedding incrementally (no full retraining):
   - **insert**: `new_behavioral = (old * old_weight + film * rating) / new_weight`
   - **delete**: reverses the contribution
   - **update**: applies delta `(new_rating - old_rating)` only
   - Then blends with interest embedding
5. Worker updates User_Profiles with new `behavioral_embedding`, `behavioral_weight_sum`, `rating_count`, `profile_embedding`

## Route Authentication

All routes under `/v1/api` are prefixed. Global middleware: CORS, cookie-parser, body-parser, rate limiter (200 req/min).

**Protected (verifyToken):** `/auth/register`, all `/query/*`, `/rate/insert-ratings`, `/rate/select-ratings`, all `/friend/*`

**Unprotected:** `/auth/signup-with-google`, `/auth/oauth2callback`, `/query/airing`, `/query/popular`, all `/analytics/*`, all `/test/*`, `/health`

**Additional validation middleware:** `validateInsertRating` on insert-ratings, `validateUpdateRating` on update-ratings

## TMDB Integration

- `queryService.ts` fetches popular and airing Korean dramas (`with_origin_country=KR`)
- Excludes genre IDs 10764 (reality), 10763 (news), 10767 (talk show), 10762 (awards)
- `tmdbService.ts:fetchTmdbOverview()` tries `/3/tv/{id}` first, falls back to `/3/movie/{id}`
- Used during registration to build the text profile for embedding generation

## Build & Run

- **Dev:** `npm run dev` (tsx watch with hot reload)
- **Build:** `npm run build` (tsc -> dist/)
- **Production:** `node dist/index.js`
- **Docker:** `docker compose up --build` (starts app + Kafka + Redis + ClickHouse)
- **TypeScript config:** strict mode, ESNext target, nodenext module resolution, source maps enabled

## Key Nuances

- The project uses ESM (`"type": "module"`) — all imports use `.js` extensions in compiled output
- `updateEmbeddingWorker.ts` resolves the Python script path using `import.meta.url` + `path.resolve` — this requires proper ESM support (Node 22+)
- Kafka consumer (`startClickHouseConsumer()`) is commented out in `index.ts` — analytics events are produced but not consumed
- The `behavioral_weight_sum` is the sum of rating values (not the count of ratings) — a 5-star rating contributes more weight than a 1-star
- `rating_count` increments/decrements separately from weight_sum
- If all ratings are deleted (weight_sum <= 0), behavioral_embedding resets to null and profile falls back to pure interest_embedding
- The Supabase client is created per-request in `verifyToken.ts` using the user's access token, ensuring RLS policies apply
- Three Supabase client types exist: user-authenticated, OAuth sign-in (singleton, PKCE), and server-side admin (service role)
- No test files exist yet despite Jest being installed
