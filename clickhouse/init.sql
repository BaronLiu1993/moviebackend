-- ClickHouse schema for engagement tracking and XGBoost ranking

-- Raw interaction events (clicks, likes, bookmarks, ratings)
CREATE TABLE IF NOT EXISTS interactions (
  user_id           String,
  tmdb_id           UInt32,
  interaction_type  Enum8('like'=1, 'bookmark'=2, 'rating'=3, 'rating_like'=4),
  rating_id         String    DEFAULT '',
  rating            Float32   DEFAULT 0,
  genre_ids         Array(UInt32) DEFAULT [],
  film_name         String    DEFAULT '',
  created_at        DateTime  DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (user_id, tmdb_id, created_at)
TTL created_at + INTERVAL 12 MONTH;

CREATE TABLE IF NOT EXISTS impressions (
  user_id     String,
  tmdb_id     UInt32,
  session_id  String,
  position    UInt16,
  surface     String    DEFAULT 'feed',
  genre_ids             Array(UInt32) DEFAULT [],
  film_name             String    DEFAULT '',
  embedding_similarity  Float32   DEFAULT 0,
  genre_overlap         Float32   DEFAULT 0,
  created_at            DateTime  DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (user_id, created_at, tmdb_id)
TTL created_at + INTERVAL 12 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS user_features_mv
ENGINE = AggregatingMergeTree()
ORDER BY user_id
AS SELECT
  user_id,
  countState()                                                    AS total_interactions,
  countIfState(interaction_type = 'rating')                       AS total_ratings,
  countIfState(interaction_type = 'like')                         AS total_likes,
  countIfState(interaction_type = 'bookmark')                     AS total_bookmarks,
  avgIfState(rating, interaction_type = 'rating' AND rating > 0)  AS avg_rating
FROM interactions
GROUP BY user_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS film_features_mv
ENGINE = AggregatingMergeTree()
ORDER BY tmdb_id
AS SELECT
  tmdb_id,
  countState()                                                    AS film_total_interactions,
  countIfState(interaction_type = 'rating')                       AS film_total_ratings,
  avgIfState(rating, interaction_type = 'rating' AND rating > 0)  AS film_avg_rating,
  countIfState(interaction_type = 'like')                         AS film_like_count,
  countIfState(interaction_type = 'bookmark')                     AS film_bookmark_count
FROM interactions
GROUP BY tmdb_id;
