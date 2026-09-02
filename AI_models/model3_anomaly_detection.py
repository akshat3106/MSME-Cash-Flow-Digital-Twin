"""
MODEL 3 — Anomaly & Volatility Detection  [STANDALONE PROTOTYPE — NOT THE
SERVED IMPLEMENTATION]

>>> READ THIS FIRST <<<

This file is an early self-contained prototype. Nothing imports it, and it
is NOT what runs in the application. It generates its own 300-row toy
transaction table to demonstrate the technique in isolation.

The Model 3 that actually serves /detect-anomalies/closed and
/detect-anomalies/open is:

    api/anomaly_api.py              endpoints, mounted into main.py
    anomaly/features_closed.py      deviation features for closed invoices
    anomaly/features_open.py        deviation features for open invoices
    anomaly/isolation_forest_detector.py
    anomaly/anomaly_explainer.py    turns scores into named anomaly types

Those read the real invoice dataset (data/raw/invoices.csv, or whatever
MODEL1_DATA_PATH points at) - tens of thousands of invoices, not 300 - and
build features as DEVIATIONS from each customer's and sector's own
baseline rather than raw amounts.

Kept for reference because it documents the z-score + Isolation Forest
combination clearly. If you are judging the dataset size or the feature
design of Model 3, read anomaly/ instead: the numbers here are a toy.

---

Flags unusual expenses/payments per business using:
  1. Rolling z-score baseline (fast, explainable first pass)
  2. Isolation Forest (unsupervised, multivariate anomaly detection)
Run directly:  python model3_anomaly_detection.py
This will generate a synthetic transaction dataset (with a few
deliberately injected anomalies), run both detectors, combine the
signals, and print/save a JSON output ready to feed into Model 8
(Causal Risk Graph) or expose via a FastAPI endpoint.
"""
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)


# ---------------------------------------------------------------------
# STEP 1: Synthetic data generator
# ---------------------------------------------------------------------
def generate_synthetic_transactions(
    n_businesses=1,
    n_customers=8,
    n_suppliers=5,
    n_transactions=300,
    start_date="2025-01-01",
) -> pd.DataFrame:
    """
    Creates a per-business transaction table:
    transaction_id, business_id, date, amount, category, counterparty

    Categories: 'customer_receipt', 'supplier_payment', 'expense'
    A handful of obvious anomalies are injected so the detectors
    have something clear to catch (useful for demo day).
    """
    rows = []
    dates = pd.date_range(start=start_date, periods=180, freq="D")

    for biz in range(1, n_businesses + 1):
        business_id = f"B{biz:03d}"
        customers = [f"Customer_{i}" for i in range(1, n_customers + 1)]
        suppliers = [f"Supplier_{i}" for i in range(1, n_suppliers + 1)]

        # give each counterparty a stable "normal" amount + category
        normal_amounts = {}
        for c in customers:
            normal_amounts[c] = np.random.uniform(15000, 60000)
        for s in suppliers:
            normal_amounts[s] = np.random.uniform(5000, 25000)

        tx_id = 1
        for _ in range(n_transactions):
            date = np.random.choice(dates)
            is_customer = np.random.rand() < 0.5

            if is_customer:
                counterparty = np.random.choice(customers)
                category = "customer_receipt"
            else:
                counterparty = np.random.choice(suppliers)
                category = np.random.choice(["supplier_payment", "expense"])

            base = normal_amounts[counterparty]
            amount = max(500, np.random.normal(base, base * 0.12))

            rows.append(
                {
                    "transaction_id": f"{business_id}-T{tx_id:04d}",
                    "business_id": business_id,
                    "date": pd.to_datetime(date),
                    "amount": round(amount, 2),
                    "category": category,
                    "counterparty": counterparty,
                }
            )
            tx_id += 1

        # --- inject deliberate anomalies for demo purposes ---
        anomaly_supplier = suppliers[0]
        anomaly_customer = customers[0]

        rows.append(
            {
                "transaction_id": f"{business_id}-T{tx_id:04d}",
                "business_id": business_id,
                "date": pd.to_datetime(dates[-10]),
                "amount": round(normal_amounts[anomaly_supplier] * 3.4, 2),  # 3x spike
                "category": "supplier_payment",
                "counterparty": anomaly_supplier,
            }
        )
        tx_id += 1

        # erratic customer: three payments in 4 days (frequency anomaly)
        for i, d in enumerate(dates[-6:-2]):
            rows.append(
                {
                    "transaction_id": f"{business_id}-T{tx_id:04d}",
                    "business_id": business_id,
                    "date": pd.to_datetime(d),
                    "amount": round(normal_amounts[anomaly_customer] * np.random.uniform(0.2, 0.4), 2),
                    "category": "customer_receipt",
                    "counterparty": anomaly_customer,
                }
            )
            tx_id += 1

    df = pd.DataFrame(rows).sort_values(["business_id", "date"]).reset_index(drop=True)
    return df


# ---------------------------------------------------------------------
# STEP 2 + 3: Feature engineering + rolling z-score baseline
# ---------------------------------------------------------------------
def compute_zscore_features(
    df: pd.DataFrame,
    group_cols=("business_id", "category", "counterparty"),
    window=10,
    z_threshold=2.5,
) -> pd.DataFrame:
    df = df.sort_values("date").copy()
    group_cols = list(group_cols)

    df["rolling_mean"] = df.groupby(group_cols)["amount"].transform(
        lambda x: x.rolling(window, min_periods=3).mean()
    )
    df["rolling_std"] = df.groupby(group_cols)["amount"].transform(
        lambda x: x.rolling(window, min_periods=3).std()
    )
    df["z_score"] = (df["amount"] - df["rolling_mean"]) / df["rolling_std"]
    df["z_score"] = df["z_score"].replace([np.inf, -np.inf], np.nan)
    df["z_flag"] = df["z_score"].abs() > z_threshold

    # extra feature: days since last transaction with same counterparty
    df["days_since_last"] = (
        df.groupby(["business_id", "counterparty"])["date"].diff().dt.days
    )

    df["day_of_month"] = df["date"].dt.day

    return df


# ---------------------------------------------------------------------
# STEP 4: Isolation Forest layer (trained per business)
# ---------------------------------------------------------------------
def run_isolation_forest(df: pd.DataFrame, contamination=0.05) -> pd.DataFrame:
    feature_cols = ["amount", "z_score", "days_since_last", "day_of_month"]
    output_frames = []

    for business_id, group in df.groupby("business_id"):
        g = group.copy()
        X = g[feature_cols].fillna(0)

        model = IsolationForest(
            n_estimators=200,
            contamination=contamination,
            random_state=RANDOM_SEED,
        )
        model.fit(X)

        g["anomaly_score"] = model.decision_function(X)  # higher = more normal
        g["is_anomaly"] = model.predict(X) == -1
        output_frames.append(g)

    return pd.concat(output_frames).sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------------
# STEP 5: Combine z-score + Isolation Forest into one flag/label
# ---------------------------------------------------------------------
def combine_flags(row) -> str:
    if row["is_anomaly"] and row["z_flag"]:
        return "high_confidence_anomaly"
    elif row["is_anomaly"] or row["z_flag"]:
        return "possible_anomaly"
    return "normal"


def label_anomaly(row) -> str:
    if row["flag_level"] == "normal":
        return ""
    if row["category"] == "supplier_payment":
        return "unusual expense"
    if row["category"] == "expense":
        return "unusual expense"
    if pd.notna(row["days_since_last"]) and row["days_since_last"] < 3:
        return "volatile payment pattern"
    return "unusual payment"


# ---------------------------------------------------------------------
# STEP 6: Build the JSON output (ready for API / Model 8 graph builder)
# ---------------------------------------------------------------------
def build_output_json(df: pd.DataFrame) -> list:
    cols = [
        "transaction_id",
        "business_id",
        "date",
        "amount",
        "category",
        "counterparty",
        "z_score",
        "anomaly_score",
        "flag_level",
        "label",
    ]
    out_df = df[cols].copy()
    out_df["date"] = out_df["date"].dt.strftime("%Y-%m-%d")
    out_df["z_score"] = out_df["z_score"].round(2)
    out_df["anomaly_score"] = out_df["anomaly_score"].round(4)
    return out_df.to_dict(orient="records")


# ---------------------------------------------------------------------
# Pipeline runner
# ---------------------------------------------------------------------
def run_pipeline(save_path="model3_output.json"):
    print("Step 1: Generating synthetic transaction dataset...")
    df = generate_synthetic_transactions()
    print(f"  -> {len(df)} transactions generated\n")

    print("Step 2-3: Computing rolling z-score features...")
    df = compute_zscore_features(df)
    print(f"  -> z-score flags: {df['z_flag'].sum()} transactions flagged\n")

    print("Step 4: Running Isolation Forest per business...")
    df = run_isolation_forest(df)
    print(f"  -> isolation forest flags: {df['is_anomaly'].sum()} transactions flagged\n")

    print("Step 5: Combining signals...")
    df["flag_level"] = df.apply(combine_flags, axis=1)
    df["label"] = df.apply(label_anomaly, axis=1)

    summary = df["flag_level"].value_counts()
    print(f"  -> combined summary:\n{summary}\n")

    print("Step 6: Building JSON output...")
    output = build_output_json(df)

    with open(save_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"  -> saved to {save_path}\n")

    # Show the flagged transactions for a quick sanity check
    flagged = df[df["flag_level"] != "normal"][
        ["transaction_id", "date", "amount", "category", "counterparty",
         "z_score", "anomaly_score", "flag_level", "label"]
    ]
    print("=== Flagged transactions preview ===")
    print(flagged.to_string(index=False))

    return df


if __name__ == "__main__":
    run_pipeline()