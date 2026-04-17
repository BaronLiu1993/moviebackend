import sys
import json
import numpy as np
import xgboost as xgb
from pathlib import Path

MODEL_PATH = Path(__file__).parent.parent / "models" / "ranker.json"

FEATURE_COLUMNS = [
    "embedding_similarity",
    "genre_overlap",
    "display_position",
    "surface_encoded",
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


def predict():
    data = json.loads(sys.stdin.read())
    candidates = data["candidates"]

    if not candidates:
        json.dump({"scores": []}, sys.stdout)
        return

    if not MODEL_PATH.exists():
        # No model trained yet — return uniform scores
        json.dump({"scores": [0.5] * len(candidates)}, sys.stdout)
        return

    model = xgb.Booster()
    model.load_model(str(MODEL_PATH))

    features = []
    for c in candidates:
        row = [c.get(col, 0) for col in FEATURE_COLUMNS]
        features.append(row)

    dmatrix = xgb.DMatrix(
        np.array(features, dtype=np.float32),
        feature_names=FEATURE_COLUMNS,
    )

    scores = model.predict(dmatrix).tolist()
    json.dump({"scores": scores}, sys.stdout)


if __name__ == "__main__":
    predict()
