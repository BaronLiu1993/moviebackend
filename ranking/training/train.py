import sys
import json
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, log_loss
from pathlib import Path

MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_PATH = MODEL_DIR / "ranker.json"

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

XGBOOST_PARAMS = {
    "objective": "binary:logistic",
    "eval_metric": ["auc", "logloss"],
    "max_depth": 6,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 5,
    "scale_pos_weight": 1,
    "tree_method": "hist",
    "seed": 42,
}


def train():
    raw = json.loads(sys.stdin.read())
    df = pd.DataFrame(raw)

    if len(df) < 100:
        json.dump({"error": "Insufficient training data", "rows": len(df)}, sys.stdout)
        sys.exit(1)

    df = df.fillna(0)

    X = df[FEATURE_COLUMNS]
    y = df["label"]
    weights = df["sample_weight"]

    # Dynamic class balancing
    neg_count = int((y == 0).sum())
    pos_count = int((y == 1).sum())
    if pos_count > 0:
        XGBOOST_PARAMS["scale_pos_weight"] = neg_count / pos_count

    X_train, X_val, y_train, y_val, w_train, w_val = train_test_split(
        X, y, weights, test_size=0.2, stratify=y, random_state=42
    )

    dtrain = xgb.DMatrix(X_train, label=y_train, weight=w_train, feature_names=FEATURE_COLUMNS)
    dval = xgb.DMatrix(X_val, label=y_val, weight=w_val, feature_names=FEATURE_COLUMNS)

    model = xgb.train(
        XGBOOST_PARAMS,
        dtrain,
        num_boost_round=200,
        evals=[(dtrain, "train"), (dval, "val")],
        early_stopping_rounds=20,
        verbose_eval=False,
    )

    val_preds = model.predict(dval)
    auc = roc_auc_score(y_val, val_preds)
    loss = log_loss(y_val, val_preds)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(str(MODEL_PATH))

    importance = model.get_score(importance_type="gain")

    result = {
        "status": "success",
        "metrics": {
            "auc": round(auc, 4),
            "logloss": round(loss, 4),
            "train_rows": len(X_train),
            "val_rows": len(X_val),
            "pos_ratio": round(pos_count / len(df), 4),
            "best_iteration": model.best_iteration,
        },
        "feature_importance": importance,
        "model_path": str(MODEL_PATH),
    }

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    train()
