"""
Find demo-legible cash parameters for a candidate business.

WHY THIS EXISTS
---------------
backend/src/config.js carries DEMO_OPENING_CASH / DEMO_DAILY_EXPENSE /
DEMO_MIN_BUFFER, and its own comment records that those numbers were found
by sweeping, not chosen: 150,000/day drove cash to -1,500,000 and pinned
breach probability at 100% (a saturated gauge reads as broken, not as a
finding), while 80,000/day produced no breach at all and the forecast
became a flat line.

That tuning is specific to one dataset's receivable volume. Point the demo
at a different business and it silently degrades to one of those two
failure modes. This script re-runs the sweep for any business so the
choice stays a measurement.

WHAT "GOOD" MEANS HERE
----------------------
  - the P50 line breaches min_buffer INSIDE the horizon, late enough to
    show a decline first (roughly days 10-27 of 30)
  - cash never goes deeply negative - a real business defaults before it
    reaches -15 lakh, so such a curve is not a forecast anyone believes
  - peak breach probability lands well short of 1.0, so the gauge reads
    as a probability rather than a stuck needle

USAGE
-----
    uv run python data/sweep_demo_params.py --business B015
    uv run python data/sweep_demo_params.py --all
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

import sys

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from model1_inference import Model1Artifacts, predict_payment_window  # noqa: E402
from simulation.monte_carlo import simulate_cashflow  # noqa: E402

BUSINESS_DIR = BASE_DIR / "data" / "raw" / "businesses"
MODEL_DIR = BASE_DIR / "models" / "businesses"

HORIZON = 30          # matches routes/dashboard.js's default
TODAY = pd.Timestamp("2026-09-02")

# Breach should be visible but not immediate.
BREACH_WINDOW = (10, 27)
MIN_CASH_FLOOR = -1_500_000
MAX_PEAK_BREACH_PROB = 0.95


def load(business_id: str):
    raw = pd.read_csv(BUSINESS_DIR / f"{business_id}_invoices.csv")
    raw["issue_date"] = pd.to_datetime(raw["issue_date"])

    artifacts = Model1Artifacts(MODEL_DIR / business_id)
    artifacts.refresh_customer_stats(raw[raw["status"] == "closed"])

    open_invoices = raw[raw["status"].isin(["open", "disputed_open"])].copy()
    predictions = predict_payment_window(open_invoices, artifacts)

    frame = predictions.rename(
        columns={
            "predicted_days_p10": "p10_payment_days",
            "predicted_days_p50": "p50_payment_days",
            "predicted_days_p90": "p90_payment_days",
        }
    )
    amounts = open_invoices.set_index("invoice_id")["invoice_amount"]
    frame["invoice_amount"] = frame["invoice_id"].map(amounts)
    frame["days_since_issue"] = (TODAY - pd.to_datetime(frame["issue_date"])).dt.days
    return raw, frame


def assess(frame, opening_cash, daily_expense, min_buffer):
    forecast, summary = simulate_cashflow(
        frame,
        opening_cash=opening_cash,
        daily_expense=daily_expense,
        horizon_days=HORIZON,
        n_sims=1500,          # sweep only - the app still runs 3000
        min_buffer=min_buffer,
    )
    below = forecast.index[forecast["cash_p50"] < min_buffer]
    breach_day = int(forecast.loc[below[0], "day"]) if len(below) else None

    return {
        "breach_day": breach_day,
        "min_cash_p50": float(forecast["cash_p50"].min()),
        "peak_breach_prob": float(forecast["prob_breach"].max()),
        "end_cash_p50": float(forecast["cash_p50"].iloc[-1]),
        "fan_width_end": float(
            forecast["cash_p90"].iloc[-1] - forecast["cash_p10"].iloc[-1]
        ),
        "forward": summary["forward_invoice_count"],
        "backlog": summary["backlog_invoice_count"],
    }


def sweep(business_id: str, verbose: bool = True):
    raw, frame = load(business_id)

    open_value = float(frame["invoice_amount"].sum())

    # Anchor the business's cash position to its own receivables rather
    # than reusing another business's rupee figures: opening cash near a
    # fortnight of expected inflow, buffer at half of that.
    opening_cash = round(open_value * 0.04, -5)
    min_buffer = round(opening_cash * 0.5, -5)

    if verbose:
        print(f"\n{business_id}: {len(raw):,} invoices, "
              f"{raw['cust_number'].nunique()} customers")
        print(f"  open receivables : Rs {open_value:,.0f}")
        print(f"  opening_cash     : Rs {opening_cash:,.0f}")
        print(f"  min_buffer       : Rs {min_buffer:,.0f}")

    # Expected daily inflow sets the scale the burn has to compete with.
    daily_inflow = open_value / 90
    grid = np.round(np.linspace(daily_inflow * 0.4, daily_inflow * 2.2, 16), -4)

    rows = []
    for daily_expense in grid:
        result = assess(frame, opening_cash, float(daily_expense), min_buffer)
        good = (
            result["breach_day"] is not None
            and BREACH_WINDOW[0] <= result["breach_day"] <= BREACH_WINDOW[1]
            and result["min_cash_p50"] > MIN_CASH_FLOOR
            and result["peak_breach_prob"] < MAX_PEAK_BREACH_PROB
        )
        rows.append({"daily_expense": float(daily_expense), "good": good, **result})

    table = pd.DataFrame(rows)
    good = table[table["good"]]

    if verbose:
        print(f"  forward/backlog  : {rows[0]['forward']} / {rows[0]['backlog']}")
        print(f"  usable settings  : {len(good)} of {len(table)}")
        if len(good):
            best = good.iloc[len(good) // 2]      # middle of the usable band
            print(f"\n  -> DEMO_OPENING_CASH  = {opening_cash:,.0f}")
            print(f"     DEMO_MIN_BUFFER    = {min_buffer:,.0f}")
            print(f"     DEMO_DAILY_EXPENSE = {best['daily_expense']:,.0f}")
            print(f"        breach day      : {best['breach_day']} of {HORIZON}")
            print(f"        min cash (P50)  : Rs {best['min_cash_p50']:,.0f}")
            print(f"        peak breach prob: {best['peak_breach_prob']:.2f}")
            print(f"        fan width day 30: Rs {best['fan_width_end']:,.0f}")
        else:
            print("  -> no setting in this grid produced a legible breach")

    return business_id, opening_cash, min_buffer, good


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--business", default="B015")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.all:
        for path in sorted(BUSINESS_DIR.glob("B*_invoices.csv")):
            sweep(path.stem.split("_")[0])
    else:
        sweep(args.business)


if __name__ == "__main__":
    main()
