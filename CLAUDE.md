# CLAUDE.md

## What This Project Is

A TypeScript + Express.js backend for an east asian film/drama discovery and rating platform. Users authenticate via Google OAuth (Supabase), rate films, manage friendships, share lists collaboratively, and receive personalized recommendations powered by OpenAI embeddings that evolve incrementally as users rate more content.

## Tech Stack

- **Runtime:** Node.js 22 + Express 5 + TypeScript (ESM modules, `"type": "module"` in package.json)
- **Database:** Supabase (PostgreSQL + Auth + RPC functions + Storage)
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dimensions)
- **Queues:** BullMQ + Redis (async embedding recomputation, scraping pipeline)
- **Analytics Pipeline:** Direct ClickHouse inserts (event tracking for interactions and impressions)
- **ML:** Python (numpy for incremental vector math)
- **Validation:** Zod schemas for all external input
- **External API:** TMDB (movie/TV metadata)

## Project Structure

```
index.ts                                # Express app entry, port 8000, dotenv/config first import
middleware/
  verifyToken.ts                        # JWT auth: extracts Bearer token, validates via Supabase, sets req.user/req.token/req.supabaseClient
  verifyAdminToken.ts                   # Admin auth: checks x-cron-admin-token header against CRON_ADMIN_TOKEN env var (read at request time for ESM compat)
  validateRating.ts                     # Two validators: validateInsertRating (checks tmdbId exists in Guanghai), validateUpdateRating (checks rating belongs to user)
  schemaValidation.ts                   # Generic Zod validation middleware: validateZod(schema)
router/
  auth/authRouter.ts                    # POST /signup, POST /login, PUT /register, GET /me
  feed/feedRouter.ts                    # GET /generate-feed, GET /search, POST /bulk-impressions
  rate/rateRouter.ts                    # POST /ratings, GET /ratings, PUT /ratings, DELETE /ratings, POST /like, DELETE /like, POST /like-rating, DELETE /like-rating
  friend/friendRouter.ts               # POST /send-request, POST /accept-request, POST /decline-request, DELETE /unfriend, GET /following, GET /followers, GET /friend-requests, GET /profile, GET /feed, POST /invite, GET /invite, POST /redeem-invite
  list/listRouter.ts                    # POST /, GET /, DELETE /, PUT /, POST /items, DELETE /items, GET /items, POST /invite, POST /redeem-invite, GET /invite, DELETE /members, GET /members
  admin/adminRouter.ts                  # POST /scrape (admin-only, triggers ETL pipeline)
  bookmark/bookmarkRouter.ts            # POST /bookmarks, GET /bookmarks, DELETE /bookmarks
service/
  auth/authService.ts                   # signUpUser, loginUser, registerUser (generates interest_embedding via OpenAI)
  feed/feedService.ts                   # getInitialFeed (RRF fusion of recommended + collaborative + popular + airing), likeFilm/unlikeFilm (Film_Likes + Guanghai.like_count)
  rate/rateService.ts                   # insertRating (with image upload support), updateRating, deleteRating, selectRatings (with signed image URLs), likeRating/unlikeRating (friendship-gated)
  friend/friendService.ts               # Friend request lifecycle, getProfile (enriched with like_count/has_liked), getFriendFeed (paginated social feed), checkIsFriends (exported), invite link system (createInvite/redeemInvite/getActiveInvites)
  search/searchService.ts               # Hybrid search: keyword (PostgreSQL FTS) + semantic (pgvector) fused via RRF
  list/listService.ts                   # Collaborative lists: CRUD, invite system, access control (owner/collaborator roles), image upload
  storage/signedUrl.ts                  # Utility: signs private Supabase Storage paths into temporary URLs (1hr expiry), batch signing support
  supabase/configureSupabase.ts         # Three client factories: createSupabaseClient(accessToken), createSignInSupabase() (PKCE OAuth), createServerSideSupabaseClient() (admin/service role)
  tmdb/tmdbService.ts                   # fetchTmdbOverview(tmdbId), fetchTmdbKeywords(tmdbId)
  clickhouse/clickhouseService.ts       # insertInteractionEvents() / insertImpressionEvent() / generateTrainingData()
  bookmark/bookmarkService.ts           # bookmarkFilm/removeBookmark/selectBookmarkFilms
etl/
  scrapeFilms.ts                        # TMDB scraper: fetches KR/JP/CN films, upserts to Films_Staging, dedupes against Guanghai, transforms and inserts with overview
  buildEmbeddingInput.ts                # Converts a Guanghai row into natural-language string for embedding
  generateEmbeddings.ts                 # Batched OpenAI embedding generation (text-embedding-3-small, 1536-dim)
  embedFilms.ts                         # Queries unembedded Guanghai rows, embeds in batches of 100, updates each row
queue/
  redis/redis.ts                        # Redis connection with TLS support, exponential backoff retry
  updateEmbedding/
    updateEmbeddingQueue.ts             # BullMQ queue "embedding-sync"
    updateEmbeddingWorker.ts            # Fetches film+user embeddings, spawns Python subprocess, updates User_Profiles
  impression/
    addImpressionQueue.ts               # BullMQ queue "impression-sync"
    addImpressionWorker.ts              # Computes embedding_similarity and genre_overlap for impressions
  scrape/
    scrapeQueue.ts                      # BullMQ queue "scrape" with ScrapeJobData type
    scrapeWorker.ts                     # Orchestrates: scrapeFilms() → embedFilms()
  training/
    trainingQueue.ts                    # BullMQ queue "training-sync" (placeholder)
    trainingWorker.ts                   # Stub worker
ranking/
  compute/incremental_embedding.py      # Core ML: incremental_insert/delete/update + blend() for profile embedding
  training/train.py                     # Stub
  inference/inference.py                # Stub
schemas/                                # Zod validation schemas for all domains
  authSchema.ts, feedSchema.ts, rateSchema.ts, friendSchema.ts, listSchema.ts, searchSchema.ts, analyticsSchema.ts, bookmarkSchema.ts
tests/                                  # Jest test suite (11 suites, 100+ tests)
clickhouse/init.sql                     # ClickHouse schema: interactions, impressions, materialized views
```

## Database Tables (Supabase PostgreSQL)

- **User_Profiles**: `user_id`, `email`, `name`, `interest_embedding`, `behavioral_embedding`, `behavioral_weight_sum`, `profile_embedding`, `rating_count`, `completed_registration`, `genres`, `movies`, `moods`, `disliked_genres`
- **Ratings**: `rating_id`, `user_id`, `tmdb_id`, `rating` (1-5), `note` (10-500 chars), `film_name`, `genre_ids` (int[]), `like_count`, `image_url`, `created_at`. Unique constraint on (user_id, tmdb_id)
- **Rating_Likes**: `like_id`, `rating_id` (FK CASCADE), `user_id`, `created_at`. Unique on (rating_id, user_id)
- **Guanghai**: `tmdb_id`, `title`, `release_year`, `genre_ids` (bigint[]), `media_type` (enum), `photo_url`, `overview`, `film_embedding` (1536-dim vector), `like_count`, `search_vector` (generated tsvector with GIN index)
- **Film_Likes**: `like_id`, `tmdb_id`, `user_id`, `created_at`. Unique on (tmdb_id, user_id)
- **Films_Staging**: Temporary staging table for ETL scrape pipeline
- **Friends**: `request_id`, `user_id`, `friend_id`, `status` (pending | accepted)
- **Friend_Invites**: `code` (PK text), `user_id`, `created_at`, `expires_at` (7-day expiry)
- **Lists**: `list_id`, `user_id`, `name`, `is_default`, `image_url`, `created_at`
- **List_Members**: `list_id`, `user_id`, `role` (owner | collaborator), `status` (accepted | pending)
- **List_Items**: `item_id`, `list_id`, `tmdb_id`, `title`, `genre_ids`, `poster_url`, `user_id`, `created_at`
- **List_Invites**: `code` (PK text), `list_id`, `user_id`, `created_at`, `expires_at`
- **Bookmarks**: `user_id`, `film_id`, `title`, `genre_ids` (int[]), `poster_url`

### ClickHouse Tables
- **interactions**: `user_id`, `tmdb_id`, `interaction_type` (enum: like, bookmark, rating, rating_like), `rating`, `genre_ids`, `film_name`, `rating_id`, `created_at`
- **impressions**: `user_id`, `tmdb_id`, `session_id`, `position`, `surface`, `genre_ids`, `film_name`, `embedding_similarity`, `genre_overlap`, `created_at`
- **user_features_mv**: Materialized view aggregating user engagement metrics
- **film_features_mv**: Materialized view aggregating film engagement metrics

## Supabase RPC Functions

- `get_recommended_films(p_user_id, limit_count, offset_count)` — cosine similarity search using profile_embedding vs film_embedding
- `get_collaborative_filters(user_id)` — returns top-10 similar user IDs by profile_embedding distance
- `is_following(p_follower_id, p_following_id)` — checks accepted friendship
- `search_films_keyword(search_query, filter_media_type, filter_country, filter_release_year, filter_genre_ids, result_limit)` — PostgreSQL full-text search on title+overview via tsvector/GIN
- `search_films_semantic(query_embedding, filter_media_type, filter_country, filter_release_year, filter_genre_ids, result_limit)` — pgvector cosine similarity search
- `increment_film_like_count(p_tmdb_id)` / `decrement_film_like_count(p_tmdb_id)` — atomic like count updates on Guanghai

## Supabase Storage Buckets

- **rating-images** — Private bucket for custom rating images. Paths: `ratings/{userId}/{tmdbId}.jpg`
- **list-images** — Private bucket for custom list cover images. Paths: `lists/{userId}/{timestamp}.jpg`

Both are private; reads go through signed URLs generated by `service/storage/signedUrl.ts` (1-hour expiry). Upload policies restrict users to their own folder.

## Core Data Flow: Embedding System

Three embedding types per user:

1. **interest_embedding** — Generated once during registration from genres/movies/moods/dislikes + TMDB overviews, sent to OpenAI `text-embedding-3-small` (1536-dim).

2. **behavioral_embedding** — Evolves incrementally every time a user rates/updates/deletes a rating. Computed by Python (`ranking/compute/incremental_embedding.py`) via weighted average.

3. **profile_embedding** — Blended: `alpha = 1/(1 + rating_count)`, `profile = alpha * interest + (1 - alpha) * behavioral`.

## Feed Ranking: Reciprocal Ranked Fusion (RRF)

The feed combines 4 result lists fused via RRF (replaced MMR):

```
RRF_score(item) = Σ [ weight / (k + rank + 1) ]  per list where item appears
```

- `k = 60`, weights: recommended=1.0, collaborative=0.7, popular=0.3, airing=0.3
- Collaborative films are deduplicated (averaged by rating) before RRF
- Post-RRF genre diversity pass penalizes genre overlap with already-selected items (`DIVERSITY_PENALTY = 0.15`)

## Hybrid Search

`GET /v1/api/feed/search` combines keyword + semantic search via RRF:
1. Keyword RPC fires immediately (PostgreSQL full-text search, no embedding needed)
2. In parallel: embed query via OpenAI → fire semantic RPC (pgvector cosine similarity)
3. Fuse via RRF (equal weights, k=60)
4. Paginate with `hasMore`

## ETL Scrape Pipeline

Triggered via `POST /v1/api/admin/scrape` (admin token) or GitHub Actions weekly cron:
1. **Scrape**: TMDB Discover API → Films_Staging (KR/JP/CN, TV + movie)
2. **Dedupe**: Compare staging vs Guanghai by tmdb_id, insert only new films with schema transform (title, release_year, genre_ids, photo_url, overview, media_type)
3. **Embed**: Query Guanghai WHERE film_embedding IS NULL, batch embed via OpenAI (100 per batch), update each row
4. **Cleanup**: Clear staging table

## Route Authentication

All routes under `/v1/api`. Global middleware: CORS, cookie-parser, body-parser, rate limiter (200 req/min).

**Protected (verifyToken):** `/auth/register`, `/auth/me`, `/feed/*`, `/rate/*`, `/friend/*`, `/list/*`, `/bookmark/*`

**Admin (verifyAdminToken):** `/admin/scrape`

**Unprotected:** `/auth/signup`, `/auth/login`, `/health`

## Key Nuances

- ESM (`"type": "module"`) — `import "dotenv/config"` must be the first import in `index.ts` (ESM hoists imports, so `dotenv.config()` as a statement runs too late)
- `verifyAdminToken` reads `process.env.CRON_ADMIN_TOKEN` at request time, not module load time, to avoid ESM import ordering issues
- `behavioral_weight_sum` is the sum of rating values (not count) — 5-star contributes more weight than 1-star
- Image URLs: private storage paths (e.g., `ratings/userId/tmdbId.jpg`) are auto-signed to 1-hour URLs by `signImageUrls()` before API responses; public URLs (TMDB posters) pass through unchanged
- Film likes (Film_Likes + Guanghai.like_count) are separate from rating likes (Rating_Likes + Ratings.like_count)
- Rating likes are friendship-gated: must be friends, can't like own rating, duplicates return 409
- Friend invite links auto-accept (no pending state) since the link IS the inviter's consent
- Collaborative filter deduplication: same film from multiple friends is averaged by rating before RRF
- Three Supabase client types: user-authenticated (per-request, RLS), OAuth sign-in (singleton, PKCE), server-side admin (service role, bypasses RLS)

## Development Workflow Rules

These rules are **mandatory** for all code changes. Do not skip or shortcut them.

### 1. Plan First, Then Execute

Before writing any code, **always present a plan** for the user to review:
- Outline what files will be created or modified
- Describe the approach and any design decisions
- List the Zod schemas that will be needed for input validation
- List the test cases that will be written
- **Wait for explicit user approval** before writing any code

If the scope changes mid-task, pause and re-plan.

### 2. Test-Driven Development (TDD)

All new code **must** follow a strict TDD cycle:
1. **Write failing tests first** — define the expected behavior before any implementation
2. **Run the tests** — confirm they fail for the right reason
3. **Write the minimal implementation** to make the tests pass
4. **Run the tests again** — confirm they pass
5. **Refactor** if needed, re-running tests after each change

Tests go in the `tests/` directory. Use Jest as the test runner with `NODE_OPTIONS="--experimental-vm-modules"`.

### 3. Input Validation with Zod

All external input **must** be validated using Zod schemas:
- **Route handlers**: Validate `req.body`, `req.params`, and `req.query` with Zod schemas before passing data to services
- **Service functions**: Accept already-validated types inferred from Zod schemas
- **Schema location**: `schemas/` directory, co-located by domain
- **Error responses**: Return 400 with validation errors
