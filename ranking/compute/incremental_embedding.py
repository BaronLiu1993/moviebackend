import sys
import json
import numpy as np


def incremental_insert(old_behavioral, old_weight_sum, film_embedding, rating):
    new_weight_sum = old_weight_sum + rating

    if old_behavioral is None or old_weight_sum == 0:
        return film_embedding.copy(), new_weight_sum

    new_behavioral = (old_behavioral * old_weight_sum + film_embedding * rating) / new_weight_sum
    return new_behavioral, new_weight_sum


def incremental_delete(old_behavioral, old_weight_sum, film_embedding, rating):
    new_weight_sum = old_weight_sum - rating

    if new_weight_sum <= 0:
        return None, 0.0

    new_behavioral = (old_behavioral * old_weight_sum - film_embedding * rating) / new_weight_sum
    return new_behavioral, new_weight_sum


def incremental_update(old_behavioral, old_weight_sum, film_embedding, old_rating, new_rating):
    delta = new_rating - old_rating
    new_weight_sum = old_weight_sum + delta

    if new_weight_sum <= 0:
        return None, 0.0

    new_behavioral = (old_behavioral * old_weight_sum + film_embedding * delta) / new_weight_sum
    return new_behavioral, new_weight_sum


def blend(interest, behavioral, rating_count):
    if behavioral is None or rating_count == 0:
        return interest.copy()

    alpha = 1.0 / (1.0 + rating_count)
    return alpha * interest + (1.0 - alpha) * behavioral


def main():
    data = json.loads(sys.stdin.read())

    operation = data["operation"]
    film_emb = np.array(data["film_embedding"], dtype=np.float64)
    interest_emb = np.array(data["interest_embedding"], dtype=np.float64)
    old_weight_sum = float(data["behavioral_weight_sum"])
    old_count = int(data["rating_count"])
    rating = float(data["rating"])

    old_behavioral = (
        np.array(data["behavioral_embedding"], dtype=np.float64)
        if data.get("behavioral_embedding") is not None
        else None
    )

    if operation == "insert":
        new_behavioral, new_weight_sum = incremental_insert(
            old_behavioral, old_weight_sum, film_emb, rating
        )
        new_count = old_count + 1

    elif operation == "delete":
        new_behavioral, new_weight_sum = incremental_delete(
            old_behavioral, old_weight_sum, film_emb, rating
        )
        new_count = max(0, old_count - 1)

    elif operation == "update":
        old_rating = float(data["old_rating"])
        new_behavioral, new_weight_sum = incremental_update(
            old_behavioral, old_weight_sum, film_emb, old_rating, rating
        )
        new_count = old_count

    else:
        print(json.dumps({"error": f"Unknown operation: {operation}"}), file=sys.stderr)
        sys.exit(1)

    profile_emb = blend(interest_emb, new_behavioral, new_count)

    result = {
        "behavioral_embedding": new_behavioral.tolist() if new_behavioral is not None else None,
        "behavioral_weight_sum": new_weight_sum,
        "rating_count": new_count,
        "profile_embedding": profile_emb.tolist(),
    }

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
