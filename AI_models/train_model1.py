"""
Model 1 training - extracted from the notebooks into a runnable script.

WHY THIS EXISTS
---------------
Model 1's training lived only in notebook/02_model_1_training.ipynb and
notebook/03_model1_quantile_and_output.ipynb. That made the trained
artifacts in models/ unreproducible in practice: retraining meant opening
a notebook and running cells in the right order, and there was no way to
train the same model over a different dataset without editing it.

This module does exactly what those notebooks do - same features, same
time-based split, same preprocessor, same RandomForest - but as a
function that takes a dataset path and writes artifacts to a directory.
That makes "train Model 1 for every business" a loop instead of eighteen
manual notebook runs.

The feature engineering and quantile extraction are deliberately imported
from or mirrored against model1_inference.py, which is the module the
FastAPI server uses. Anything that drifts between the two becomes a
train/serve skew, so rf_quantile_predict is imported rather than
reimplemented.

POINT-IN-TIME FEATURES
----------------------
Every customer-history feature is built with .shift(1) before any
expanding or rolling window. An invoice's features therefore describe
only the invoices that came BEFORE it. Without the shift, each row would
carry its own payment outcome inside its own input and the model would
score beautifully while having learned nothing - the classic leak for
this problem shape.

USAGE
-----
    # one business
    uv run python train_model1.py --data data/raw/invoices.csv --out models

    # every generated business, with a comparison table
    uv run python train_model1.py --all-businesses
"""
from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from model1_inference import FEATURE_COLUMNS, rf_quantile_predict

BASE_DIR = Path(__file__).resolve().parent
BUSINESS_DIR = BASE_DIR / "data" / "raw" / "businesses"
BUSINESS_MODEL_DIR = BASE_DIR / "models" / "businesses"
METRICS_PATH = BASE_DIR / "evaluation" / "model1_per_business_metrics.csv"

TARGET = "days_to_payment"

NUMERIC_FEATURES = [
    "customer_avg_payment_days",
    "customer_recent_avg_payment_days",
    "customer_invoice_count",
    "customer_payment_std",
    "payment_behavior_trend",
    "previous_payment_days",
    "invoice_amount",
    "payment_term_days",
]
CATEGORICAL_FEATURES = ["sector"]

# The original split used hard-coded dates (train <= 2025-10-05, test >=
# 2026-02-15) which worked out to 70/15/15. Expressed as fractions here so
# the same proportions apply to any dataset regardless of its date range.
TRAIN_FRACTION = 0.70
VALIDATION_FRACTION = 0.15

# Matches notebook 03's rf_quantile_model exactly. 200 trees is what the
# quantile spread is taken across - see rf_quantile_predict - so changing
# it changes the width of every P10/P90 band, not just runtime.
N_ESTIMATORS = 200
RANDOM_STATE = 42


def build_features(raw: pd.DataFrame) -> pd.DataFrame:
    """
    Build Model 1's customer-history features from a raw invoice table.

    Only closed invoices are usable: the target is days_to_payment, which
    an unpaid invoice does not have. Open invoices are what the trained
    model later PREDICTS, via /predict/open-invoices.
    """
    df = raw[raw["status"] == "closed"].copy()
    df["issue_date"] = pd.to_datetime(df["issue_date"])
    df = df.sort_values(["cust_number", "issue_date"]).reset_index(drop=True)

    grouped = df.groupby("cust_number")[TARGET]

    # .shift(1) everywhere - see the module docstring on leakage.
    df["previous_payment_days"] = grouped.shift(1)
    df["customer_avg_payment_days"] = grouped.transform(
        lambda x: x.shift(1).expanding().mean()
    )
    df["customer_recent_avg_payment_days"] = grouped.transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    df["customer_payment_std"] = grouped.transform(
        lambda x: x.shift(1).expanding().std()
    )
    df["customer_invoice_count"] = df.groupby("cust_number").cumcount()
    df["payment_behavior_trend"] = (
        df["customer_recent_avg_payment_days"] - df["customer_avg_payment_days"]
    )

    return df


def time_split(df: pd.DataFrame):
    """
    Split by issue_date, oldest to newest.

    A random split would let the model train on invoices issued AFTER the
    ones it is tested on, which is not a situation the deployed model ever
    faces. The time split reproduces the real question: given everything
    up to today, what happens next?
    """
    df = df.sort_values("issue_date").reset_index(drop=True)
    train_end = df["issue_date"].quantile(TRAIN_FRACTION)
    val_end = df["issue_date"].quantile(TRAIN_FRACTION + VALIDATION_FRACTION)

    train = df[df["issue_date"] <= train_end].copy()
    validation = df[
        (df["issue_date"] > train_end) & (df["issue_date"] <= val_end)
    ].copy()
    test = df[df["issue_date"] > val_end].copy()
    return train, validation, test


def apply_sector_prior(frame, sector_priors, global_prior):
    """
    Fill missing history with the sector's average behaviour.

    A customer's first invoice has no prior invoices, so every history
    feature is NaN. The sector average is the honest stand-in: it is what
    the model knows about "a customer like this one" before it knows
    anything about this customer specifically.
    """
    frame = frame.copy()
    sector_fill = frame["sector"].map(sector_priors).fillna(global_prior)

    for col in [
        "customer_avg_payment_days",
        "customer_recent_avg_payment_days",
        "previous_payment_days",
    ]:
        frame[col] = frame[col].fillna(sector_fill)

    frame["customer_payment_std"] = frame["customer_payment_std"].fillna(0)
    frame["payment_behavior_trend"] = frame["payment_behavior_trend"].fillna(0)
    return frame


def evaluate(model, preprocessor, frame) -> dict:
    """
    Score a split.

    Reports the point-estimate error (MAE/RMSE against P50) and, more
    importantly for this project, INTERVAL COVERAGE: how often the actual
    payment day actually landed inside the predicted P10-P90 band. A
    well-calibrated band should contain ~80% of outcomes. That number is
    what justifies presenting a range rather than a single date, so it
    matters more here than MAE alone.
    """
    X = preprocessor.transform(frame[FEATURE_COLUMNS])
    y = frame[TARGET].to_numpy()

    quantiles = rf_quantile_predict(model, X)
    p10 = quantiles["p10"].to_numpy()
    p50 = quantiles["p50"].to_numpy()
    p90 = quantiles["p90"].to_numpy()

    inside = (y >= p10) & (y <= p90)

    return {
        "rows": len(frame),
        "mae": float(mean_absolute_error(y, p50)),
        "rmse": float(np.sqrt(np.mean((y - p50) ** 2))),
        "p10_p90_coverage": float(inside.mean()),
        "mean_band_width": float(np.mean(p90 - p10)),
    }


def train(data_path: Path, model_dir: Path, quiet: bool = False) -> dict:
    """Train Model 1 on one dataset and write its artifacts."""
    raw = pd.read_csv(data_path)
    featured = build_features(raw)
    train_df, validation_df, test_df = time_split(featured)

    # Priors are computed on TRAIN ONLY. Deriving them from the whole
    # dataset would leak the test period's payment behaviour into the
    # fallback used when predicting it.
    sector_priors = train_df.groupby("sector")[TARGET].mean()
    global_prior = float(train_df[TARGET].mean())

    train_df = apply_sector_prior(train_df, sector_priors, global_prior)
    validation_df = apply_sector_prior(validation_df, sector_priors, global_prior)
    test_df = apply_sector_prior(test_df, sector_priors, global_prior)

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

    model = RandomForestRegressor(
        n_estimators=N_ESTIMATORS,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(
        preprocessor.transform(train_df[FEATURE_COLUMNS]),
        train_df[TARGET],
    )

    model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(preprocessor, model_dir / "model1_preprocessor.joblib")
    joblib.dump(model, model_dir / "model1_rf_quantile.joblib")
    joblib.dump(sector_priors, model_dir / "model1_sector_priors.joblib")
    joblib.dump(global_prior, model_dir / "model1_global_prior.joblib")

    validation_scores = evaluate(model, preprocessor, validation_df)
    test_scores = evaluate(model, preprocessor, test_df)

    # Error per customer archetype. This is the honest part of the report:
    # erratic payers SHOULD score worse than prompt payers, and a model
    # that scored them equally would be suspicious rather than impressive.
    archetype_mae = {}
    if "customer_archetype_TRUE_LABEL" in test_df.columns:
        X_test = preprocessor.transform(test_df[FEATURE_COLUMNS])
        predicted = rf_quantile_predict(model, X_test)["p50"].to_numpy()
        errors = np.abs(test_df[TARGET].to_numpy() - predicted)
        archetype_mae = (
            pd.Series(errors, index=test_df["customer_archetype_TRUE_LABEL"])
            .groupby(level=0)
            .mean()
            .round(2)
            .to_dict()
        )

    if not quiet:
        print(f"\n{data_path.name}")
        print(f"  train/val/test rows : {len(train_df):,} / "
              f"{len(validation_df):,} / {len(test_df):,}")
        print(f"  validation MAE      : {validation_scores['mae']:.2f} days")
        print(f"  test MAE            : {test_scores['mae']:.2f} days")
        print(f"  test RMSE           : {test_scores['rmse']:.2f} days")
        print(f"  P10-P90 coverage    : {test_scores['p10_p90_coverage']:.1%}")
        print(f"  mean band width     : {test_scores['mean_band_width']:.1f} days")
        if archetype_mae:
            print("  test MAE by archetype:")
            for name, value in sorted(
                archetype_mae.items(), key=lambda kv: kv[1], reverse=True
            ):
                print(f"    {name:22} {value:6.2f}")

    return {
        "dataset": data_path.stem,
        "customers": raw["cust_number"].nunique(),
        "invoices": len(raw),
        "closed": len(featured),
        "train_rows": len(train_df),
        "val_rows": len(validation_df),
        "test_rows": len(test_df),
        "val_mae": round(validation_scores["mae"], 2),
        "test_mae": round(test_scores["mae"], 2),
        "test_rmse": round(test_scores["rmse"], 2),
        "p10_p90_coverage": round(test_scores["p10_p90_coverage"], 4),
        "mean_band_width": round(test_scores["mean_band_width"], 1),
        "archetype_mae": archetype_mae,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Model 1.")
    parser.add_argument("--data", type=str, default="data/raw/invoices.csv")
    parser.add_argument("--out", type=str, default="models")
    parser.add_argument(
        "--all-businesses",
        action="store_true",
        help="Train one model per generated business and write a comparison table.",
    )
    args = parser.parse_args()

    if not args.all_businesses:
        train(BASE_DIR / args.data, BASE_DIR / args.out)
        return

    paths = sorted(BUSINESS_DIR.glob("B*_invoices.csv"))
    if not paths:
        raise SystemExit(
            f"no business datasets in {BUSINESS_DIR} - "
            "run data/generate_invoices.py first"
        )

    results = []
    for path in paths:
        business_id = path.stem.split("_")[0]
        results.append(
            train(path, BUSINESS_MODEL_DIR / business_id, quiet=True)
        )
        latest = results[-1]
        print(
            f"{business_id}  {latest['customers']:>3} customers  "
            f"{latest['invoices']:>6,} invoices  "
            f"test MAE {latest['test_mae']:>6.2f}  "
            f"coverage {latest['p10_p90_coverage']:.1%}"
        )

    table = pd.DataFrame(results).drop(columns=["archetype_mae"])
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(METRICS_PATH, index=False)

    print(f"\n{len(results)} businesses trained")
    print(f"total invoices    : {table['invoices'].sum():,}")
    print(
        f"test MAE          : {table['test_mae'].min():.2f} - "
        f"{table['test_mae'].max():.2f} days "
        f"(mean {table['test_mae'].mean():.2f})"
    )
    print(
        f"P10-P90 coverage  : {table['p10_p90_coverage'].min():.1%} - "
        f"{table['p10_p90_coverage'].max():.1%} "
        f"(mean {table['p10_p90_coverage'].mean():.1%})"
    )
    print(f"\nwrote {METRICS_PATH}")


if __name__ == "__main__":
    main()
