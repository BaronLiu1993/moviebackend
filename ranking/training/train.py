"""
Train XGBoost binary classifier for feed ranking.

Fetches training data from ClickHouse (impressions joined with interactions),
trains a model to predict P(interaction | impression), and saves the model artifact.

Usage:
    python ranking/training/train.py

Env vars:
    CLICKHOUSE_URL      (default: http://localhost:8123)
    CLICKHOUSE_USER     (default: default)
    CLICKHOUSE_PASSWORD (default: default)
"""

import os
import json
import urllib.request
import urllib.parse
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, log_loss
from pathlib import Path

CLICKHOUSE_URL = os.environ.get("CLICKHOUSE_URL", "http://localhost:8123")
CLICKHOUSE_USER = os.environ.get("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.environ.get("CLICKHOUSE_PASSWORD", "default")

MODEL_DIR = Path(__file__).parent
MODEL_PATH = MODEL_DIR / "model.json"

TRAINING_QUERY = """
SELECT
  i.user_id,
  i.tmdb_id,
  IF(ix.tmdb_id IS NOT NULL, 1, 0) AS label,

  i.position                        AS display_position,
  i.surface,
  toHour(i.created_at)              AS hour_of_day,
  toDayOfWeek(i.created_at)         AS day_of_week,

  countMerge(u.total_interactions)   AS user_total_interactions,
  countMerge(u.total_ratings)        AS user_total_ratings,
  countMerge(u.total_likes)          AS user_total_likes,
  countMerge(u.total_bookmarks)      AS user_total_bookmarks,
  avgMerge(u.avg_rating)             AS user_avg_rating,

  countMerge(f.film_total_interactions) AS film_total_interactions,
  countMerge(f.film_total_ratings)      AS film_total_ratings,
  avgMerge(f.film_avg_rating)           AS film_avg_rating,
  countMerge(f.film_like_count)         AS film_like_count,
  countMerge(f.film_bookmark_count)     AS film_bookmark_count

FROM impressions i

LEFT JOIN (
  SELECT DISTINCT user_id, tmdb_id, created_at AS interaction_time
  FROM interactions
) ix ON i.user_id = ix.user_id
     AND i.tmdb_id = ix.tmdb_id
     AND ix.interaction_time BETWEEN i.created_at AND i.created_at + INTERVAL 24 HOUR

LEFT JOIN user_features_mv u ON i.user_id = u.user_id
LEFT JOIN film_features_mv f ON i.tmdb_id = f.tmdb_id

WHERE i.created_at >= now() - INTERVAL 90 DAY

GROUP BY i.user_id, i.tmdb_id, i.position, i.surface, i.created_at, label
ORDER BY i.user_id, i.created_at
FORMAT JSONEachRow
"""

FEATURE_COLS = [
    "display_position",
    "hour_of_day",
    "day_of_week",
    "user_total_interactions",
    "user_total_ratings",
    "user_total_likes",
    "user_total_bookmarks",
    "user_avg_rating",
    "film_total_interactions",
    "film_total_ratings",
    "film_avg_rating",
    "film_like_count",
    "film_bookmark_count",
]

CATEGORICAL_COLS = ["surface"]


def fetch_training_data() -> pd.DataFrame:
    """Fetch training data from ClickHouse via HTTP interface."""
    params = urllib.parse.urlencode({
        "user": CLICKHOUSE_USER,
        "password": CLICKHOUSE_PASSWORD,
    })
    url = f"{CLICKHOUSE_URL}/?{params}"

    req = urllib.request.Request(url, data=TRAINING_QUERY.encode("utf-8"))
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8").strip()

    if not body:
        raise ValueError("No training data returned from ClickHouse")

    rows = [json.loads(line) for line in body.split("\n") if line.strip()]
    df = pd.DataFrame(rows)

    for col in FEATURE_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    for col in CATEGORICAL_COLS:
        df[col] = df[col].astype("category")

    return df


def train(df: pd.DataFrame) -> xgb.XGBClassifier:
    """Train XGBoost binary classifier."""
    all_features = FEATURE_COLS + CATEGORICAL_COLS
    X = df[all_features]
    y = df["label"].astype(int)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pos_count = y_train.sum()
    neg_count = len(y_train) - pos_count
    scale_pos_weight = neg_count / max(pos_count, 1)

    model = xgb.XGBClassifier(
        objective="binary:logistic",
        eval_metric="logloss",
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        enable_categorical=True,
        random_state=42,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=True,
    )

    y_pred = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, y_pred)
    ll = log_loss(y_val, y_pred)
    print(f"\nValidation AUC: {auc:.4f}")
    print(f"Validation LogLoss: {ll:.4f}")
    print(f"Positive rate (train): {pos_count / len(y_train):.4f}")
    print(f"Samples: {len(df)} total, {len(X_train)} train, {len(X_val)} val")

    return model


def main():
    print("Fetching training data from ClickHouse...")
    df = fetch_training_data()
    print(f"Fetched {len(df)} rows ({df['label'].sum():.0f} positives)")

    print("\nTraining XGBoost model...")
    model = train(df)

    model.save_model(str(MODEL_PATH))
    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
