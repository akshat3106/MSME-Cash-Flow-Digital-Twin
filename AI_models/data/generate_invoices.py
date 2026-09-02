"""
Parameterised, seeded generator for the MSME invoice dataset.

WHY THIS EXISTS
---------------
The original data/raw/invoices.csv (5,305 invoices, 180 customers, one
business) was a static artifact - nothing in this repository could
reproduce it. That is a problem twice over:

  1. "Increase the size of your dataset" cannot be answered by re-running
     anything, because there was nothing to re-run.
  2. "How was this data generated?" had no answer in the code, which is a
     harder version of the same question.

This module replaces that artifact with a generator whose parameters were
MEASURED from the original file, so newly generated data keeps the same
statistical character rather than inventing a new one. Every constant
below is annotated with the figure it was fitted to.

WHAT IT PRODUCES
----------------
One CSV per simulated MSME (data/raw/businesses/B0xx_invoices.csv) plus a
combined all_businesses.csv.

Per-business files are deliberate. Every consumer in this project -
main.py's /predict/open-invoices, Model 2's simulate_cashflow, the risk
graph, model_7.py - reads its whole input file and treats it as ONE
business's book. Feeding those a mixed multi-business file would not
raise an error; it would silently forecast 18 companies' receivables
against a single company's opening cash. Keeping one business per file
means none of that code has to change, and main.py can already point at
any of them through the MODEL1_DATA_PATH environment variable.

The businesses are deliberately different sizes (25-250 customers). A
loop that emits 18 identical books demonstrates nothing except the loop;
varying the size is what supports the claim that the pipeline works for a
small MSME with thin history as well as a large one.

INTERNAL CONSISTENCY
--------------------
Downstream code depends on these invariants, so they are enforced here
rather than assumed:

    due_date            = issue_date + payment_term_days
    actual_paid_date    = issue_date + days_to_payment
    delay_vs_due_date   = days_to_payment - payment_term_days
    open/disputed_open  -> actual_paid_date, days_to_payment and
                           delay_vs_due_date are all blank

An invoice is closed only if its payment date has actually arrived by the
generation date. That single rule produces the open/closed mix naturally
instead of hard-coding a ratio, and guarantees no "closed" invoice claims
to have been paid in the future.

USAGE
-----
    cd AI_models && uv run python data/generate_invoices.py
    cd AI_models && uv run python data/generate_invoices.py --businesses 18
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "data" / "raw" / "businesses"
COMBINED_PATH = BASE_DIR / "data" / "raw" / "all_businesses.csv"

# The exact column order of the original invoices.csv, with business_id
# inserted after invoice_id. Adding a column is safe for every reader:
# Model 1's FEATURE_COLUMNS does not include it, and model_7.py's
# validate_dataset() checks that required columns are PRESENT, not that
# no others exist.
COLUMNS = [
    "invoice_id",
    "business_id",
    "cust_number",
    "customer_name",
    "sector",
    "payment_term_days",
    "invoice_amount",
    "issue_date",
    "due_date",
    "status",
    "actual_paid_date",
    "days_to_payment",
    "delay_vs_due_date",
    "had_partial_payment_flag",
    "is_big_ticket_spike",
    "customer_archetype_TRUE_LABEL",
]


# =====================================================================
# MEASURED PARAMETERS
#
# Every figure below was computed from the original 5,305-invoice
# dataset. Changing one changes how faithful the output is to it.
# =====================================================================

# Invoice amounts are strongly right-skewed in every sector (the standard
# deviation exceeds the mean in most of them), so a lognormal is the
# natural fit. sigma is derived from the observed median/mean pair:
# for a lognormal, median = exp(mu) and mean = exp(mu + sigma^2 / 2),
# hence sigma = sqrt(2 * ln(mean / median)).
SECTOR_AMOUNTS = {
    # sector:                     (median, sigma)
    "Textiles & Apparel":          (56_168, 1.405),
    "FMCG & Food Processing":      (68_671, 1.638),
    "Auto Components":             (74_916, 1.278),
    "Retail & Distribution":       (87_237, 1.286),
    "Construction & Infra":        (95_414, 1.278),
    "Pharma & Healthcare":        (100_361, 0.970),
    "IT & Business Services":     (116_435, 1.339),
    "Chemicals & Plastics":       (119_990, 1.213),
    "Metal & Engineering":        (124_529, 0.816),
    "Electronics & Electricals":  (137_205, 1.339),
}

# Observed customer counts per sector, normalised into sampling weights.
SECTOR_WEIGHTS = {
    "Retail & Distribution": 26,
    "Chemicals & Plastics": 24,
    "Auto Components": 21,
    "FMCG & Food Processing": 21,
    "Construction & Infra": 18,
    "Metal & Engineering": 17,
    "Textiles & Apparel": 17,
    "Pharma & Healthcare": 15,
    "IT & Business Services": 12,
    "Electronics & Electricals": 9,
}

# Observed payment-term distribution (15:353, 30:2153, 45:1766, 60:823,
# 90:210 across 5,305 invoices).
PAYMENT_TERMS = [15, 30, 45, 60, 90]
PAYMENT_TERM_WEIGHTS = [353, 2153, 1766, 823, 210]

# Observed customer counts per archetype, used as sampling weights.
ARCHETYPE_WEIGHTS = {
    "average_payer": 51,
    "prompt_payer": 37,
    "cold_start": 18,
    "seasonal_payer": 17,
    "erratic_payer": 16,
    "deteriorating_payer": 15,
    "chronic_late_payer": 14,
    "improving_payer": 12,
}

# Observed delay_vs_due_date range per archetype, used to clip generated
# values so no archetype produces delays it never exhibited.
ARCHETYPE_DELAY_RANGE = {
    "prompt_payer": (-9, 16),
    "average_payer": (-12, 32),
    "cold_start": (-10, 28),
    "seasonal_payer": (-8, 30),
    "erratic_payer": (-44, 135),
    "improving_payer": (-5, 69),
    "deteriorating_payer": (-2, 76),
    "chronic_late_payer": (14, 83),
}

# Observed flag rates.
PARTIAL_PAYMENT_RATE = 0.0292
BIG_TICKET_RATE = 0.0441

# A big-ticket invoice is not merely large in absolute terms - it is large
# RELATIVE to that customer's usual invoice. In the original data these
# land around 3-5x the customer's typical amount.
BIG_TICKET_MULTIPLIER = (3.0, 5.0)

# Observed invoices per customer: mean 29.5, std 14.6, range 2-54.
INVOICES_PER_CUSTOMER = (29.5, 14.6, 5, 54)

# cold_start customers exist precisely to be thin - 18 of them account for
# only 50 invoices in the original data (~2.8 each). Model 1's
# MIN_HISTORY_FOR_CONFIDENCE is 3, so these are the customers that
# exercise the sector-prior fallback.
COLD_START_INVOICE_RANGE = (2, 4)

# Within-customer amount variation, on top of the customer's own base
# amount drawn from its sector's distribution.
WITHIN_CUSTOMER_SIGMA = 0.30

# History window. The original data spans ~2.5 years.
HISTORY_DAYS = 900

# A small share of invoices are never collected at all. These stay open
# regardless of age and are what populate the overdue backlog and the
# risk graph - without them, every open invoice is merely recent and the
# risk graph has nothing to show.
NEVER_PAID_RATE = 0.015

# Share of open invoices that are disputed rather than merely unpaid
# (observed: 83 disputed of 347 open).
DISPUTED_SHARE = 0.24


@dataclass
class BusinessSpec:
    """One simulated MSME."""

    business_id: str
    n_customers: int
    seed: int


def build_business_specs(n_businesses: int, seed: int) -> list[BusinessSpec]:
    """
    Lay out the businesses across three size tiers.

    Varying the sizes is the point: it is what lets the per-business
    metrics table answer "how does this perform for a SMALL MSME with
    thin history?" with a measurement rather than an opinion.
    """
    rng = np.random.default_rng(seed)

    # (share of businesses, customer-count range)
    tiers = [
        (0.34, (25, 50)),    # small MSME
        (0.44, (80, 150)),   # mid MSME
        (0.22, (180, 250)),  # larger MSME
    ]

    specs: list[BusinessSpec] = []
    index = 1
    for share, (low, high) in tiers:
        count = max(1, round(n_businesses * share))
        for _ in range(count):
            if index > n_businesses:
                break
            specs.append(
                BusinessSpec(
                    business_id=f"B{index:03d}",
                    n_customers=int(rng.integers(low, high + 1)),
                    seed=seed + index,
                )
            )
            index += 1

    # Rounding the tier shares can leave the last slot(s) unfilled.
    while index <= n_businesses:
        specs.append(
            BusinessSpec(
                business_id=f"B{index:03d}",
                n_customers=int(rng.integers(80, 151)),
                seed=seed + index,
            )
        )
        index += 1

    return specs


def sample_delays(
    rng: np.random.Generator,
    archetype: str,
    n: int,
    issue_dates: pd.DatetimeIndex,
) -> np.ndarray:
    """
    Draw `delay_vs_due_date` for one customer's invoices, in issue order.

    Three archetypes are TIME-DEPENDENT rather than merely noisy, and
    that distinction is what makes the model's per-archetype error
    breakdown meaningful. If all eight were drawn from static
    distributions, improving/deteriorating/seasonal would be
    indistinguishable from average_payer and the breakdown would stop
    measuring anything.
    """
    if archetype == "prompt_payer":
        delays = rng.normal(-0.11, 3.57, n)

    elif archetype == "average_payer":
        delays = rng.normal(5.68, 6.56, n)

    elif archetype == "cold_start":
        delays = rng.normal(6.16, 8.41, n)

    elif archetype == "chronic_late_payer":
        delays = rng.normal(33.67, 13.08, n)

    elif archetype == "seasonal_payer":
        # Delay swings with the month of issue - a business whose
        # customers pay slower in their off-season. Amplitude and base
        # spread together reproduce the observed std of 7.46.
        phase = rng.uniform(0, 2 * np.pi)
        month = issue_dates.month.to_numpy()
        seasonal = 6.0 * np.sin(2 * np.pi * (month - 1) / 12 + phase)
        delays = rng.normal(8.27, 5.8, n) + seasonal

    elif archetype == "erratic_payer":
        # Genuinely hard to predict: mostly moderate, with a heavy tail of
        # very late payments. Modelled as a mixture, which reproduces the
        # observed std of 22.16 and the -44..135 range that a single
        # normal cannot.
        #
        # This archetype should STAY hard. Its ~21-day error in the
        # evaluation is evidence the model is not overfitting a tidy
        # simulation, so smoothing it here would quietly make the whole
        # dataset less honest.
        tail = rng.random(n) < 0.20
        delays = np.where(
            tail,
            rng.normal(37.0, 38.0, n),
            rng.normal(6.0, 8.0, n),
        )

    elif archetype == "improving_payer":
        # Pays progressively faster across its invoice history.
        t = np.linspace(0.0, 1.0, n) if n > 1 else np.zeros(1)
        delays = 35.0 + (4.0 - 35.0) * t + rng.normal(0, 9.0, n)

    elif archetype == "deteriorating_payer":
        # The mirror image - a customer sliding into late payment.
        t = np.linspace(0.0, 1.0, n) if n > 1 else np.zeros(1)
        delays = 8.0 + (39.0 - 8.0) * t + rng.normal(0, 13.0, n)

    else:
        raise ValueError(f"unknown archetype: {archetype}")

    low, high = ARCHETYPE_DELAY_RANGE[archetype]
    return np.clip(np.round(delays), low, high)


def generate_business(
    spec: BusinessSpec,
    today: date,
    invoice_prefix: int,
) -> pd.DataFrame:
    """Generate one MSME's complete invoice book."""
    rng = np.random.default_rng(spec.seed)

    sectors = list(SECTOR_WEIGHTS)
    sector_p = np.array([SECTOR_WEIGHTS[s] for s in sectors], dtype=float)
    sector_p /= sector_p.sum()

    archetypes = list(ARCHETYPE_WEIGHTS)
    archetype_p = np.array(
        [ARCHETYPE_WEIGHTS[a] for a in archetypes], dtype=float
    )
    archetype_p /= archetype_p.sum()

    term_p = np.array(PAYMENT_TERM_WEIGHTS, dtype=float)
    term_p /= term_p.sum()

    history_start = pd.Timestamp(today) - pd.Timedelta(days=HISTORY_DAYS)
    rows = []
    invoice_seq = 1

    for customer_index in range(1, spec.n_customers + 1):
        sector = rng.choice(sectors, p=sector_p)
        archetype = rng.choice(archetypes, p=archetype_p)
        payment_term = int(rng.choice(PAYMENT_TERMS, p=term_p))

        cust_number = f"{spec.business_id}-C{1000 + customer_index}"
        customer_name = (
            f"{sector.split(' ')[0]} Client {customer_index:03d}"
        )

        # How many invoices this customer has. cold_start customers are
        # deliberately thin - they are the ones that exercise Model 1's
        # sector-prior fallback path.
        if archetype == "cold_start":
            n_invoices = int(rng.integers(*COLD_START_INVOICE_RANGE))
        else:
            mean, std, low, high = INVOICES_PER_CUSTOMER
            n_invoices = int(np.clip(round(rng.normal(mean, std)), low, high))

        # This customer's typical invoice size, drawn from its sector.
        median, sigma = SECTOR_AMOUNTS[sector]
        base_amount = rng.lognormal(np.log(median), sigma * 0.7)

        # Issue dates, ordered oldest first so the time-dependent
        # archetypes trend in the right direction.
        offsets = np.sort(rng.integers(0, HISTORY_DAYS, n_invoices))
        issue_dates = pd.DatetimeIndex(
            [history_start + pd.Timedelta(days=int(o)) for o in offsets]
        )

        delays = sample_delays(rng, archetype, n_invoices, issue_dates)

        # An invoice cannot be paid before it is issued. The floor can bite
        # when a short payment term meets a large negative delay (a 15-day
        # term with an erratic_payer's -44), so delay is re-derived from
        # the floored value afterwards - otherwise the two columns would
        # disagree and break delay = days_to_payment - payment_term, which
        # downstream code treats as guaranteed.
        days_to_payment = np.maximum(payment_term + delays, 1).astype(int)
        delays = days_to_payment - payment_term

        amounts = base_amount * rng.lognormal(
            0.0, WITHIN_CUSTOMER_SIGMA, n_invoices
        )
        big_ticket = rng.random(n_invoices) < BIG_TICKET_RATE
        amounts = np.where(
            big_ticket,
            amounts * rng.uniform(*BIG_TICKET_MULTIPLIER, n_invoices),
            amounts,
        )

        # Some invoices are simply never collected. Weighted toward the
        # archetypes where that is plausible, so the overdue backlog is
        # not uniformly spread across well-behaved customers.
        never_paid_rate = NEVER_PAID_RATE * (
            3.0
            if archetype in ("chronic_late_payer", "erratic_payer")
            else 1.0
        )
        never_paid = rng.random(n_invoices) < never_paid_rate

        for i in range(n_invoices):
            issue_date = issue_dates[i]
            due_date = issue_date + pd.Timedelta(days=payment_term)
            paid_date = issue_date + pd.Timedelta(
                days=int(days_to_payment[i])
            )

            # THE status rule: closed only if payment has actually
            # happened by now. Everything else is still outstanding.
            is_closed = (
                not never_paid[i] and paid_date.date() <= today
            )

            if is_closed:
                status = "closed"
                actual_paid = paid_date.strftime("%Y-%m-%d")
                dtp: int | str = int(days_to_payment[i])
                delay: int | str = int(delays[i])
                partial = bool(rng.random() < PARTIAL_PAYMENT_RATE)
            else:
                status = (
                    "disputed_open"
                    if rng.random() < DISPUTED_SHARE
                    else "open"
                )
                # Blank, not zero - these columns are unknown for an
                # unpaid invoice, and Model 1 filters on status == closed
                # precisely so it never trains on a guessed value.
                actual_paid = ""
                dtp = ""
                delay = ""
                partial = False

            rows.append(
                {
                    "invoice_id": f"INV{invoice_prefix}{invoice_seq:06d}",
                    "business_id": spec.business_id,
                    "cust_number": cust_number,
                    "customer_name": customer_name,
                    "sector": sector,
                    "payment_term_days": payment_term,
                    "invoice_amount": round(float(amounts[i]), 2),
                    "issue_date": issue_date.strftime("%Y-%m-%d"),
                    "due_date": due_date.strftime("%Y-%m-%d"),
                    "status": status,
                    "actual_paid_date": actual_paid,
                    "days_to_payment": dtp,
                    "delay_vs_due_date": delay,
                    "had_partial_payment_flag": partial,
                    "is_big_ticket_spike": bool(big_ticket[i]),
                    "customer_archetype_TRUE_LABEL": archetype,
                }
            )
            invoice_seq += 1

    df = pd.DataFrame(rows, columns=COLUMNS)
    return df.sort_values(["cust_number", "issue_date"]).reset_index(drop=True)


def summarise(df: pd.DataFrame, label: str) -> None:
    """Print the figures worth checking against the original dataset."""
    closed = df[df["status"] == "closed"].copy()
    closed["delay_vs_due_date"] = pd.to_numeric(closed["delay_vs_due_date"])

    print(f"\n--- {label} ---")
    print(f"invoices          : {len(df):,}")
    print(f"customers         : {df['cust_number'].nunique():,}")
    print(f"status            : {df['status'].value_counts().to_dict()}")
    print(
        f"flags             : partial "
        f"{df['had_partial_payment_flag'].mean():.4f}, "
        f"big-ticket {df['is_big_ticket_spike'].mean():.4f}"
    )
    print("\ndelay_vs_due_date by archetype (target in the docstring):")
    print(
        closed.groupby("customer_archetype_TRUE_LABEL")["delay_vs_due_date"]
        .agg(["mean", "std", "min", "max", "count"])
        .round(2)
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate the MSME invoice dataset."
    )
    parser.add_argument("--businesses", type=int, default=18)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--today",
        type=str,
        default=None,
        help="Generation date (YYYY-MM-DD). Defaults to the system date.",
    )
    args = parser.parse_args()

    today = (
        date.fromisoformat(args.today) if args.today else date.today()
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    specs = build_business_specs(args.businesses, args.seed)
    frames = []

    print(f"generating {len(specs)} businesses (today = {today})")

    for position, spec in enumerate(specs, start=1):
        df = generate_business(spec, today, invoice_prefix=position)
        path = OUTPUT_DIR / f"{spec.business_id}_invoices.csv"
        df.to_csv(path, index=False)
        frames.append(df)
        print(
            f"  {spec.business_id}: {spec.n_customers:>3} customers, "
            f"{len(df):>6,} invoices -> {path.name}"
        )

    combined = pd.concat(frames, ignore_index=True)
    combined.to_csv(COMBINED_PATH, index=False)

    summarise(combined, "ALL BUSINESSES COMBINED")

    print(f"\nwrote {len(specs)} per-business files to {OUTPUT_DIR}")
    print(f"wrote combined dataset to {COMBINED_PATH}")
    print(f"total invoices: {len(combined):,}")


if __name__ == "__main__":
    main()
