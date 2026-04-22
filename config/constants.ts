// ─── Feed Ranking ────────────────────────────────────────────
export const RRF_K = 60;
export const RRF_WEIGHTS = {
  recommended: 1.0,
  collaborative: 0.7,
  popular: 0.3,
  airing: 0.3,
} as const;
export const DIVERSITY_PENALTY = 0.15;
export const FEED_CACHE_TTL_BASE = 3600;
export const FEED_CACHE_JITTER = 300;
export const FEED_CACHE_PREFIX = "feed:";
export const RPC_BATCH_SIZE = 300;
export const MAX_POOL_SIZE = 300;

// Search
export const SEARCH_RRF_K = 60;
export const SEARCH_RRF_WEIGHTS = {
  keyword: 1.0,
  semantic: 1.0,
} as const;
export const SEARCH_RPC_LIMIT = 100;

// Signal Values (ClickHouse + Embedding) 
export const SIGNAL_VALUES = {
  LIKE: 3.0,
  BOOKMARK: 1.5,
  RATING_LIKE: 0.5,
} as const;

// Storage
export const SIGNED_URL_EXPIRY = 3600;
export const BUCKET_MAP: Record<string, string> = {
  "ratings/": "rating-images",
  "lists/": "list-images",
};
export const DEFAULT_LIST_IMAGE = "https://image.tmdb.org/t/p/w500/placeholder.jpg";

// Scraper
export const SCRAPE_COUNTRIES = ["KR", "JP", "CN"] as const;
export const SCRAPE_PAGES_TO_FETCH = 10;
export const SCRAPE_MIN_POPULARITY = 10;
export const SCRAPE_EXCLUDED_GENRES = "10764,10763,10767,10762";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
export const SCRAPE_BATCH_SIZE = 500;

// Embedding ETL
export const EMBED_BATCH_DELAY_MS = 200;
