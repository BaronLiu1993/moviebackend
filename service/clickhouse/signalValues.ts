// Unified signal values for ClickHouse and embedding system
// These MUST stay in sync — any change here affects both analytics and recommendations

export const SIGNAL_VALUES = {
  LIKE: 3.0,
  BOOKMARK: 1.5,
  RATING_LIKE: 0.5,
} as const;
