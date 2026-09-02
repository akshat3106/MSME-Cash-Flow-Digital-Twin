"""
Actual vs predicted days-to-payment - old dataset vs new dataset, side by side.

WHY THIS EXISTS
---------------
The benchmark tables report MAE/RMSE/coverage as numbers. This is the same
comparison as a picture: every test-set invoice plotted as (actual days,
predicted days), with the y=x line marking a perfect prediction. Points
hugging the line are good calls; points far from it are the model's misses -
and the SPREAD of the cloud is a more honest read of "how good is this,
really" than a single averaged error figure.

OLD panel uses AI_models/.demo_backup/invoices.dataraw.csv - the original
single-business dataset, preserved when the demo was swapped onto business
B015 (see backend/src/config.js and data/rebase_demo_dates.py history).

NEW panel pools the test-set predictions from all 18 generated businesses
(data/raw/businesses/*.csv), trained independently per business exactly as
train_model1.py does it - this is the same per-business-model architecture
the app runs, not one shared model.

USAGE
-----
    uv run python evaluation/plot_actual_vs_predicted.py
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.ticker import MultipleLocator
from sklearn.metrics import mean_absolute_error, r2_score

import sys
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from model1_inference import FEATURE_COLUMNS, rf_quantile_predict  # noqa: E402
from benchmark_model1 import (  # noqa: E402
    fit_random_forest,
    make_preprocessor,
    prepare,
)

OLD_DATASET = BASE_DIR / ".demo_backup" / "invoices.dataraw.csv"
BUSINESS_DIR = BASE_DIR / "data" / "raw" / "businesses"
OUT_PATH = BASE_DIR / "evaluation" / "actual_vs_predicted.png"

# Validated against both surfaces via the dataviz skill's colorblind-safety
# checker (scripts/validate_palette.js) - same pair used across the slide
# deck, so this chart reads as part of the same set.
RF_BLUE = "#0B6E9B"
BRICK = "#B2543C"
INK = "#0C1A24"
INK_2 = "#3A505D"
MUTED = "#8098A5"
RULE = "#D7E1E5"
PAPER = "#FBFCFC"


def get_test_predictions(path: Path):
    train_df, _, test_df = prepare(path)
    preprocessor = make_preprocessor(train_df)
    model = fit_random_forest(train_df, preprocessor)

    X_test = preprocessor.transform(test_df[FEATURE_COLUMNS])
    predicted = rf_quantile_predict(model, X_test)["p50"].to_numpy()
    actual = test_df["days_to_payment"].to_numpy()
    return actual, predicted


def collect_new_dataset_predictions():
    all_actual, all_predicted = [], []
    for path in sorted(BUSINESS_DIR.glob("B*_invoices.csv")):
        actual, predicted = get_test_predictions(path)
        all_actual.append(actual)
        all_predicted.append(predicted)
    return np.concatenate(all_actual), np.concatenate(all_predicted)


def style_axis(ax, upper):
    ax.set_facecolor(PAPER)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(RULE)
    ax.tick_params(colors=INK_2, labelsize=10.5)
    ax.set_xlim(0, upper)
    ax.set_ylim(0, upper)
    ax.xaxis.set_major_locator(MultipleLocator(20))
    ax.yaxis.set_major_locator(MultipleLocator(20))
    ax.grid(True, color=RULE, linewidth=0.7, alpha=0.6)
    ax.set_axisbelow(True)


def draw_panel(ax, actual, predicted, title, subtitle, color, upper):
    style_axis(ax, upper)

    ax.plot([0, upper], [0, upper], color=INK, linewidth=1.4,
             linestyle=(0, (5, 3)), alpha=0.55, zorder=2,
             label="Perfect prediction (y = x)")

    # Alpha scales down as point count grows so a 7,000-point cloud reads
    # as a density rather than a solid blob, while a 700-point one stays
    # individually visible.
    alpha = float(np.clip(400 / len(actual), 0.05, 0.55))
    size = 14 if len(actual) < 2000 else 7

    ax.scatter(actual, predicted, s=size, color=color, alpha=alpha,
               linewidths=0, zorder=3)

    mae = mean_absolute_error(actual, predicted)
    r2 = r2_score(actual, predicted)

    ax.set_title(title, fontsize=15, fontweight="bold", color=INK, pad=2,
                 loc="left")
    ax.text(0, 1.045, subtitle, transform=ax.transAxes, fontsize=10.5,
            color=MUTED, va="bottom")

    stats = (f"n = {len(actual):,}   MAE = {mae:.2f} days   "
             f"R² = {r2:.2f}")
    ax.text(0.97, 0.06, stats, transform=ax.transAxes, fontsize=10.5,
            color=INK_2, ha="right", va="bottom",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="white",
                       edgecolor=RULE, linewidth=0.8))

    ax.set_xlabel("Actual days to payment", fontsize=11, color=INK_2)
    ax.set_ylabel("Predicted days to payment (P50)", fontsize=11, color=INK_2)


def main():
    print("training on OLD dataset (single business, backed-up original)...")
    old_actual, old_predicted = get_test_predictions(OLD_DATASET)

    print("training per-business on NEW dataset (18 businesses, pooled test set)...")
    new_actual, new_predicted = collect_new_dataset_predictions()

    upper = float(np.ceil(max(old_actual.max(), old_predicted.max(),
                               new_actual.max(), new_predicted.max()) / 20) * 20)

    fig, axes = plt.subplots(1, 2, figsize=(13, 6.2), dpi=170)
    fig.patch.set_facecolor(PAPER)

    draw_panel(axes[0], old_actual, old_predicted,
               "OLD — single business",
               "5,305 invoices · 1 business · test set", RF_BLUE, upper)
    draw_panel(axes[1], new_actual, new_predicted,
               "NEW — 18 businesses",
               "54,174 invoices · 18 businesses, pooled test sets", BRICK, upper)

    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper center", bbox_to_anchor=(0.5, 1.02),
               ncol=1, frameon=False, fontsize=10.5, labelcolor=INK_2)

    fig.suptitle("Actual vs. predicted payment days — Model 1",
                 fontsize=17.5, fontweight="bold", color=INK, y=1.11, x=0.02,
                 ha="left")

    fig.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(OUT_PATH, facecolor=PAPER, bbox_inches="tight")
    print(f"\nsaved -> {OUT_PATH}")

    old_mae = mean_absolute_error(old_actual, old_predicted)
    new_mae = mean_absolute_error(new_actual, new_predicted)
    print(f"OLD: n={len(old_actual):,}  MAE={old_mae:.2f}  R2={r2_score(old_actual, old_predicted):.3f}")
    print(f"NEW: n={len(new_actual):,}  MAE={new_mae:.2f}  R2={r2_score(new_actual, new_predicted):.3f}")


if __name__ == "__main__":
    main()
