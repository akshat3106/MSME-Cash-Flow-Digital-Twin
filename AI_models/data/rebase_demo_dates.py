"""
Rebase the demo dataset's dates onto "today".

WHY THIS EXISTS
---------------
invoices.csv was generated with issue dates in Jan-Oct 2024 and then sat
unchanged while real-world time moved on. By Aug 2026 every open invoice was
~950 days old, which broke the demo in three visible ways:

  1. Model 2's backlog split (simulation/monte_carlo.py) classifies an invoice
     as "backlog" - excluded from day-by-day simulation - when
     days_since_issue > p50_payment_days. With every invoice ~950 days old
     against a ~55-day p50, EVERY invoice was backlog, leaving zero forward
     inflows. The Monte Carlo then had nothing to vary, so optimistic /
     expected / pessimistic came out numerically identical and the forecast
     rendered as a single straight line - the exact "one guessed number" the
     project's headline claim says it moved beyond.
  2. The risk graph showed edge labels like "859 days overdue".
  3. Breach probability pinned at 100%.

SAFETY
------
Model 1's FEATURE_COLUMNS (model1_inference.py) contains no date-derived
feature - only customer-history deltas (avg/std/trend/previous payment days)
and invoice attributes (amount, term, sector). Shifting dates therefore does
not change any model input, and the trained artifacts in models/ stay valid.
No retraining is required.

Every derived date is recomputed from the new issue_date plus the ORIGINAL
delta, so days_to_payment, delay_vs_due_date and the payment-term
relationship are preserved exactly. Only the calendar position moves.

IDEMPOTENT
----------
Target positions are absolute ("newest open invoice sits 2 days before
today"), not relative shifts, so running this twice produces the same result
as running it once.

USAGE
-----
    cd AI_models && .venv/Scripts/python data/rebase_demo_dates.py
"""
from __future__ import annotations

import shutil
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent

# Both copies must stay in sync - the backend gateway reads the root-level
# invoices.csv while Model 1's own server reads data/raw/invoices.csv.
TARGETS = [
    BASE_DIR / "invoices.csv",
    BASE_DIR / "data" / "raw" / "invoices.csv",
]

# Open invoices are spread across this window, newest first. Chosen so that a
# realistic mix falls either side of the ~55-day median prediction: the recent
# end stays "forward" (still-plausible future payments, which is what gives
# Model 2 something to simulate and produces the optimistic/pessimistic fan),
# while the older end is genuinely overdue and populates the risk graph.
OPEN_NEWEST_DAYS_AGO = 2
OPEN_OLDEST_DAYS_AGO = 150

# Closed invoices are accumulated payment history. The most recent one lands
# here; the rest keep their original spacing behind it.
CLOSED_NEWEST_DAYS_AGO = 30

OPEN_STATUSES = ["open", "disputed_open"]

# Not every one of these exists in every dataset. The three P10/P50/P90
# columns belong to an older schema that carried Model 1's predictions in
# the CSV itself; the current invoices.csv does not have them, and
# addressing a missing column raised KeyError and took the whole script
# down. They stay listed so that a dataset which DOES carry them still has
# them rebased - see the filter in rebase().
DATE_COLUMNS = [
    "issue_date",
    "due_date",
    "actual_paid_date",
    "optimistic_paid_date_P10",
    "expected_paid_date_P50",
    "pessimistic_paid_date_P90",
]


def rebase(df: pd.DataFrame, today: date) -> pd.DataFrame:
    df = df.copy()

    date_columns = [col for col in DATE_COLUMNS if col in df.columns]
    for col in date_columns:
        df[col] = pd.to_datetime(df[col], errors="coerce")

    # Capture each derived date's offset from its own issue_date BEFORE moving
    # anything, so they can be rebuilt against the new issue_date afterwards.
    offsets = {
        col: (df[col] - df["issue_date"]).dt.days
        for col in date_columns
        if col != "issue_date"
    }

    is_open = df["status"].isin(OPEN_STATUSES)

    # --- Open invoices: rescale into the demo window -------------------
    # Original ordering and proportional spacing are preserved; only the span
    # is compressed, so the oldest open invoice reads as ~150 days overdue
    # rather than ~950.
    open_issue = df.loc[is_open, "issue_date"]
    span = (open_issue.max() - open_issue.min()).days
    position = (
        (open_issue - open_issue.min()).dt.days / span if span else 0.0
    )  # 0.0 = oldest, 1.0 = newest
    new_age = OPEN_OLDEST_DAYS_AGO - position * (
        OPEN_OLDEST_DAYS_AGO - OPEN_NEWEST_DAYS_AGO
    )
    df.loc[is_open, "issue_date"] = pd.Timestamp(today) - pd.to_timedelta(
        new_age.round(), unit="D"
    )

    # --- Closed invoices: uniform shift --------------------------------
    # A single offset keeps the accumulated history's internal shape exactly
    # as generated - only its calendar position changes.
    closed_issue = df.loc[~is_open, "issue_date"]
    closed_shift = (
        pd.Timestamp(today) - timedelta(days=CLOSED_NEWEST_DAYS_AGO)
    ) - closed_issue.max()
    df.loc[~is_open, "issue_date"] = closed_issue + closed_shift

    # --- Rebuild every derived date from the preserved offsets ---------
    for col, offset in offsets.items():
        df[col] = df["issue_date"] + pd.to_timedelta(offset, unit="D")

    for col in date_columns:
        df[col] = df[col].dt.strftime("%Y-%m-%d")

    return df


def main() -> None:
    today = date.today()
    source = TARGETS[0]
    rebased = rebase(pd.read_csv(source), today)

    for target in TARGETS:
        if target.exists() and not target.with_suffix(".csv.backup").exists():
            shutil.copy(target, target.with_suffix(".csv.backup"))
        rebased.to_csv(target, index=False)
        print(f"rebased -> {target}")

    check = rebased.copy()
    check["issue_date"] = pd.to_datetime(check["issue_date"])
    age = (pd.Timestamp(today) - check["issue_date"]).dt.days
    is_open = check["status"].isin(OPEN_STATUSES)
    print(f"\ntoday = {today}")
    print(f"open invoice age:   {age[is_open].min()}-{age[is_open].max()} days")
    print(f"closed invoice age: {age[~is_open].min()}-{age[~is_open].max()} days")
    # ~55 is Model 1's typical p50; invoices younger than that stay "forward"
    # and are what give Model 2 a distribution to simulate.
    print(f"open invoices under 55 days old (forward): {(age[is_open] < 55).sum()}")


if __name__ == "__main__":
    main()
