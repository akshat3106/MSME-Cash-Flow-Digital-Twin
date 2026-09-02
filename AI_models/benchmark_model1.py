"""
Model 1 benchmarks - the evidence behind the modelling choices.

Four questions, each one a claim someone could reasonably challenge:

  1. OLD vs NEW DATA
     Did scaling from one business (5,305 invoices) to eighteen (54,174)
     change the error? If accuracy jumped, the new data would be easier
     than the old - a sign the generator smoothed the problem rather than
     enlarging it. Flat is the honest outcome.

  2. RANDOM FOREST vs XGBOOST, as quantile models
     The README originally claimed a "quantile objective (pinball loss)",
     which is XGBoost's reg:quantileerror. This trains that model for
     real - three of them, at alpha 0.1/0.5/0.9 - and compares it against
     the Random Forest on BOTH point error and interval coverage. The
     earlier notebook comparison only checked point error, so it could
     not actually justify the interval, which is the thing the product
     shows on screen.

  3. CROSS-BUSINESS TRANSFER
     Model 1 is trained per business. Is that necessary, or would one
     shared model do? Train on business A, test on business B. If the
     error degrades, per-business training is justified by measurement
     rather than assertion.

  4. LEARNING CURVE
     "Increase the size of your dataset" deserves an empirical answer:
     does more history actually reduce error, or has it plateaued?
     Trains on growing slices of one business's history and reports
     where the curve flattens.

USAGE
-----
    uv run python benchmark_model1.py
    uv run python benchmark_model1.py --only transfer
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from model1_inference import FEATURE_COLUMNS, rf_quantile_predict
from train_model1 import (
    CATEGORICAL_FEATURES,
    N_ESTIMATORS,
    NUMERIC_FEATURES,
    RANDOM_STATE,
    TARGET,
    apply_sector_prior,
    build_features,
    time_split,
)

BASE_DIR = Path(__file__).resolve().parent
BUSINESS_DIR = BASE_DIR / "data" / "raw" / "businesses"
OLD_DATASET = BASE_DIR / "data" / "raw" / "invoices.csv"
REPORT_DIR = BASE_DIR / "evaluation"

QUANTILE_ALPHAS = [0.10, 0.50, 0.90]


def prepare(path: Path):
    """Load a dataset and return its train/val/test frames, priors applied."""
    raw = pd.read_csv(path)
    featured = build_features(raw)
    train_df, validation_df, test_df = time_split(featured)

    sector_priors = train_df.groupby("sector")[TARGET].mean()
    global_prior = float(train_df[TARGET].mean())

    return (
        apply_sector_prior(train_df, sector_priors, global_prior),
        apply_sector_prior(validation_df, sector_priors, global_prior),
        apply_sector_prior(test_df, sector_priors, global_prior),
    )


def make_preprocessor(train_df):
    preprocessor = ColumnTransformer(
        [
            (
                "num",
                Pipeline([("imputer", SimpleImputer(strategy="median"))]),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline([("encoder", OneHotEncoder(handle_unknown="ignore"))]),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    preprocessor.fit(train_df[FEATURE_COLUMNS])
    return preprocessor


def fit_random_forest(train_df, preprocessor):
    model = RandomForestRegressor(
        n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1
    )
    model.fit(preprocessor.transform(train_df[FEATURE_COLUMNS]), train_df[TARGET])
    return model


def fit_xgboost_quantiles(train_df, preprocessor):
    """
    Three XGBoost models with the pinball-loss quantile objective - the
    approach the README used to describe. One model per quantile, since
    reg:quantileerror optimises a single alpha at a time.
    """
    from xgboost import XGBRegressor

    X = preprocessor.transform(train_df[FEATURE_COLUMNS])
    y = train_df[TARGET]

    models = {}
    for alpha in QUANTILE_ALPHAS:
        model = XGBRegressor(
            objective="reg:quantileerror",
            quantile_alpha=alpha,
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
        model.fit(X, y)
        models[alpha] = model
    return models


def score(y, p10, p50, p90) -> dict:
    inside = (y >= p10) & (y <= p90)
    return {
        "mae": float(mean_absolute_error(y, p50)),
        "rmse": float(np.sqrt(np.mean((y - p50) ** 2))),
        "coverage": float(inside.mean()),
        "band_width": float(np.mean(p90 - p10)),
    }


def score_random_forest(model, preprocessor, frame) -> dict:
    X = preprocessor.transform(frame[FEATURE_COLUMNS])
    q = rf_quantile_predict(model, X)
    return score(
        frame[TARGET].to_numpy(),
        q["p10"].to_numpy(),
        q["p50"].to_numpy(),
        q["p90"].to_numpy(),
    )


def score_xgboost(models, preprocessor, frame) -> dict:
    X = preprocessor.transform(frame[FEATURE_COLUMNS])
    predictions = {a: models[a].predict(X) for a in QUANTILE_ALPHAS}
    # Quantile crossing is possible when each alpha is fitted independently;
    # sorting enforces p10 <= p50 <= p90 rather than reporting a negative
    # interval width.
    stacked = np.sort(
        np.vstack([predictions[a] for a in QUANTILE_ALPHAS]), axis=0
    )
    return score(frame[TARGET].to_numpy(), stacked[0], stacked[1], stacked[2])


# =====================================================================
# 1. OLD DATA vs NEW DATA
# =====================================================================

def benchmark_old_vs_new() -> pd.DataFrame:
    print("\n" + "=" * 66)
    print("1. OLD DATASET vs NEW DATASET")
    print("=" * 66)

    rows = []

    train_df, _, test_df = prepare(OLD_DATASET)
    preprocessor = make_preprocessor(train_df)
    model = fit_random_forest(train_df, preprocessor)
    result = score_random_forest(model, preprocessor, test_df)
    rows.append(
        {
            "dataset": "OLD (single business)",
            "train_rows": len(train_df),
            "test_rows": len(test_df),
            **result,
        }
    )

    metrics_path = REPORT_DIR / "model1_per_business_metrics.csv"
    if metrics_path.exists():
        per_business = pd.read_csv(metrics_path)
        rows.append(
            {
                "dataset": "NEW (18 businesses, mean)",
                "train_rows": int(per_business["train_rows"].sum()),
                "test_rows": int(per_business["test_rows"].sum()),
                "mae": per_business["test_mae"].mean(),
                "rmse": per_business["test_rmse"].mean(),
                "coverage": per_business["p10_p90_coverage"].mean(),
                "band_width": per_business["mean_band_width"].mean(),
            }
        )

    table = pd.DataFrame(rows)
    print(table.round(3).to_string(index=False))
    return table


# =====================================================================
# 2. RANDOM FOREST vs XGBOOST
# =====================================================================

def benchmark_algorithms(n_businesses: int = 5) -> pd.DataFrame:
    print("\n" + "=" * 66)
    print("2. RANDOM FOREST vs XGBOOST (both as quantile models)")
    print("=" * 66)

    paths = sorted(BUSINESS_DIR.glob("B*_invoices.csv"))[:n_businesses]
    rows = []

    for path in paths:
        business_id = path.stem.split("_")[0]
        train_df, _, test_df = prepare(path)
        preprocessor = make_preprocessor(train_df)

        rf = score_random_forest(
            fit_random_forest(train_df, preprocessor), preprocessor, test_df
        )
        xgb = score_xgboost(
            fit_xgboost_quantiles(train_df, preprocessor), preprocessor, test_df
        )

        rows.append({"business": business_id, "model": "RandomForest", **rf})
        rows.append({"business": business_id, "model": "XGBoost", **xgb})
        print(
            f"  {business_id}  RF  MAE {rf['mae']:5.2f}  cov {rf['coverage']:.1%}"
            f"   |  XGB  MAE {xgb['mae']:5.2f}  cov {xgb['coverage']:.1%}"
        )

    table = pd.DataFrame(rows)
    print("\nmean across businesses:")
    print(
        table.groupby("model")[["mae", "rmse", "coverage", "band_width"]]
        .mean()
        .round(3)
        .to_string()
    )
    return table


# =====================================================================
# 3. CROSS-BUSINESS TRANSFER
# =====================================================================

def benchmark_transfer(n_businesses: int = 4) -> pd.DataFrame:
    print("\n" + "=" * 66)
    print("3. CROSS-BUSINESS TRANSFER (train on A, test on B)")
    print("=" * 66)

    paths = sorted(BUSINESS_DIR.glob("B*_invoices.csv"))[:n_businesses]
    prepared = {}
    for path in paths:
        business_id = path.stem.split("_")[0]
        train_df, _, test_df = prepare(path)
        prepared[business_id] = (train_df, test_df)

    trained = {}
    for business_id, (train_df, _) in prepared.items():
        preprocessor = make_preprocessor(train_df)
        trained[business_id] = (
            preprocessor,
            fit_random_forest(train_df, preprocessor),
        )

    rows = []
    for source, (preprocessor, model) in trained.items():
        for target, (_, test_df) in prepared.items():
            result = score_random_forest(model, preprocessor, test_df)
            rows.append(
                {
                    "trained_on": source,
                    "tested_on": target,
                    "same_business": source == target,
                    **result,
                }
            )

    table = pd.DataFrame(rows)
    print("\nMAE matrix (rows = trained on, columns = tested on):")
    print(
        table.pivot(index="trained_on", columns="tested_on", values="mae")
        .round(2)
        .to_string()
    )

    own = table[table["same_business"]]["mae"].mean()
    other = table[~table["same_business"]]["mae"].mean()
    print(f"\n  own business      : {own:.2f} days MAE")
    print(f"  other business    : {other:.2f} days MAE")
    print(f"  degradation       : {other - own:+.2f} days ({other / own - 1:+.1%})")
    return table


# =====================================================================
# 4. LEARNING CURVE
# =====================================================================

def benchmark_learning_curve(business_id: str = "B015") -> pd.DataFrame:
    print("\n" + "=" * 66)
    print(f"4. LEARNING CURVE ({business_id})")
    print("=" * 66)

    path = BUSINESS_DIR / f"{business_id}_invoices.csv"
    train_df, _, test_df = prepare(path)
    train_df = train_df.sort_values("issue_date")

    rows = []
    for fraction in [0.10, 0.25, 0.50, 0.75, 1.00]:
        # Take the MOST RECENT slice: the practical question is "how much
        # history do we need", and recent history is what a real business
        # would have if it had been running the tool for less time.
        subset = train_df.tail(int(len(train_df) * fraction))
        preprocessor = make_preprocessor(subset)
        model = fit_random_forest(subset, preprocessor)
        result = score_random_forest(model, preprocessor, test_df)
        rows.append({"fraction": fraction, "train_rows": len(subset), **result})
        print(
            f"  {fraction:>5.0%}  {len(subset):>5,} rows   "
            f"MAE {result['mae']:5.2f}   coverage {result['coverage']:.1%}"
        )

    table = pd.DataFrame(rows)
    first, last = table["mae"].iloc[0], table["mae"].iloc[-1]
    print(f"\n  MAE from 10% to 100% of history: {first:.2f} -> {last:.2f} days")
    return table


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Model 1.")
    parser.add_argument(
        "--only",
        choices=["oldnew", "algorithms", "transfer", "curve"],
        help="Run a single benchmark instead of all four.",
    )
    args = parser.parse_args()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "oldnew": ("model1_bench_old_vs_new.csv", benchmark_old_vs_new),
        "algorithms": ("model1_bench_algorithms.csv", benchmark_algorithms),
        "transfer": ("model1_bench_transfer.csv", benchmark_transfer),
        "curve": ("model1_bench_learning_curve.csv", benchmark_learning_curve),
    }

    selected = [args.only] if args.only else list(outputs)
    for key in selected:
        filename, function = outputs[key]
        function().to_csv(REPORT_DIR / filename, index=False)
        print(f"\n  -> evaluation/{filename}")


if __name__ == "__main__":
    main()
