"""
Dataset scale and train/test split - old vs new, as charts.

Two images:
    dataset_comparison.png   - 6 small-multiple panels, one per metric,
                                each on its own scale (a shared linear axis
                                would make "1 vs 18" invisible next to
                                "5,305 vs 54,174")
    train_test_split.png     - split counts (log-scale, since new is ~10x
                                old) next to split proportions (linear %,
                                to show the ratio held constant)

Numbers are the same ones already reported in the README / benchmark
tables - this module only draws them.

USAGE
-----
    uv run python evaluation/plot_dataset_comparison.py
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BASE_DIR = Path(__file__).resolve().parent

# Same validated pair used across the rest of this deck / the actual-vs-
# predicted chart, so all the figures read as one set.
RF_BLUE = "#0B6E9B"
BRICK = "#B2543C"
INK = "#0C1A24"
INK_2 = "#3A505D"
MUTED = "#8098A5"
RULE = "#D7E1E5"
PAPER = "#FBFCFC"


def style_axis(ax):
    ax.set_facecolor(PAPER)
    for spine in ("top", "right", "left"):
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(RULE)
    ax.tick_params(colors=INK_2, labelsize=9.5)
    ax.set_yticks([])


def bar_panel(ax, title, old_val, new_val, fmt="{:,.0f}"):
    style_axis(ax)
    bars = ax.bar(["OLD", "NEW"], [old_val, new_val],
                   color=[RF_BLUE, BRICK], width=0.56, zorder=3)
    top = max(old_val, new_val)
    ax.set_ylim(0, top * 1.28 if top > 0 else 1)

    for bar, val in zip(bars, [old_val, new_val]):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + top * 0.045,
                fmt.format(val), ha="center", va="bottom",
                fontsize=12.5, fontweight="bold", color=INK)

    ax.set_title(title, fontsize=12.5, fontweight="bold", color=INK, pad=10)

    # Placed BELOW the bars (in the tick-label margin), never above - a
    # note positioned in axes-fraction space above the axes collided with
    # the title, which matplotlib places using a points-based pad on a
    # different coordinate system. Below the x-axis has guaranteed clear
    # space regardless of that mismatch.
    if old_val > 0 and new_val != old_val:
        mult = new_val / old_val
        note = f"×{mult:.1f}" if abs(mult - round(mult)) > 0.05 else f"×{mult:.0f}"
        color, weight = BRICK, "bold"
    else:
        note, color, weight = "unchanged", MUTED, "normal"

    ax.text(0.5, -0.22, note, transform=ax.transAxes, ha="center", va="top",
            fontsize=10.5, color=color, fontweight=weight, style=(
                "italic" if note == "unchanged" else "normal"))


def make_dataset_comparison():
    metrics = [
        ("Businesses (MSMEs)", 1, 18, "{:,.0f}"),
        ("Total invoices", 5305, 54174, "{:,.0f}"),
        ("Customers", 180, 2030, "{:,.0f}"),
        ("Sectors", 10, 10, "{:,.0f}"),
        ("Closed (trainable)", 4958, 50014, "{:,.0f}"),
        ("Open + disputed", 347, 4160, "{:,.0f}"),
    ]

    fig, axes = plt.subplots(2, 3, figsize=(12.5, 8.2), dpi=170)
    fig.patch.set_facecolor(PAPER)

    for ax, (title, old, new, fmt) in zip(axes.flat, metrics):
        bar_panel(ax, title, old, new, fmt)

    handles = [
        plt.Rectangle((0, 0), 1, 1, color=RF_BLUE),
        plt.Rectangle((0, 0), 1, 1, color=BRICK),
    ]
    fig.legend(handles, ["OLD — 1 business", "NEW — 18 businesses"],
               loc="upper center", bbox_to_anchor=(0.5, 1.015), ncol=2,
               frameon=False, fontsize=11.5, labelcolor=INK_2)

    fig.suptitle("Dataset scale — old vs. new",
                  fontsize=18, fontweight="bold", color=INK,
                  y=1.10, x=0.015, ha="left")
    fig.text(0.015, 1.045,
              "Sectors held constant; every other dimension grew with the "
              "number of simulated businesses.",
              fontsize=10.5, color=MUTED, ha="left")

    # tight_layout runs FIRST to place the outer margins (title, legend,
    # subtitle), then subplots_adjust widens the row gap on top of that -
    # calling it before tight_layout gets silently overwritten, since
    # tight_layout recomputes all subplot spacing from scratch.
    fig.tight_layout(rect=[0, 0, 1, 0.90])
    fig.subplots_adjust(hspace=0.75, wspace=0.35)

    out = BASE_DIR / "dataset_comparison.png"
    fig.savefig(out, facecolor=PAPER, bbox_inches="tight")
    print(f"saved -> {out}")


def make_train_test_split():
    labels = ["Train", "Validation", "Test"]
    old_counts = np.array([3470, 744, 744])
    new_counts = np.array([35039, 7493, 7482])
    old_pct = old_counts / old_counts.sum() * 100
    new_pct = new_counts / new_counts.sum() * 100

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.8), dpi=170)
    fig.patch.set_facecolor(PAPER)

    # --- panel 1: absolute row counts, log scale (new is ~10x old) -----
    ax1.set_facecolor(PAPER)
    for spine in ("top", "right"):
        ax1.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax1.spines[spine].set_color(RULE)
    ax1.tick_params(colors=INK_2, labelsize=10.5)

    x = np.arange(len(labels))
    w = 0.32
    b1 = ax1.bar(x - w / 2, old_counts, width=w, color=RF_BLUE, label="OLD", zorder=3)
    b2 = ax1.bar(x + w / 2, new_counts, width=w, color=BRICK, label="NEW", zorder=3)
    ax1.set_yscale("log")
    ax1.set_ylim(300, 60000)
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, fontsize=11.5, color=INK)
    ax1.grid(True, axis="y", which="major", color=RULE, linewidth=0.7, alpha=0.7)
    ax1.set_axisbelow(True)
    ax1.set_ylabel("Rows (log scale)", fontsize=10.5, color=INK_2)
    ax1.set_title("Row counts", fontsize=13.5, fontweight="bold", color=INK,
                   pad=10, loc="left")

    for bars, counts in [(b1, old_counts), (b2, new_counts)]:
        for bar, val in zip(bars, counts):
            ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() * 1.08,
                      f"{val:,.0f}", ha="center", va="bottom",
                      fontsize=9.5, fontweight="bold", color=INK)

    ax1.legend(frameon=False, fontsize=10.5, labelcolor=INK_2, loc="upper left")

    # --- panel 2: split proportion, linear % - shows the ratio held ----
    ax2.set_facecolor(PAPER)
    for spine in ("top", "right"):
        ax2.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax2.spines[spine].set_color(RULE)
    ax2.tick_params(colors=INK_2, labelsize=10.5)

    colors = [RF_BLUE, "#6FA8C2", BRICK]
    bottoms_old = np.concatenate([[0], np.cumsum(old_pct)[:-1]])
    bottoms_new = np.concatenate([[0], np.cumsum(new_pct)[:-1]])

    for i in range(len(labels)):
        ax2.bar(["OLD"], [old_pct[i]], bottom=[bottoms_old[i]],
                color=colors[i], width=0.5, zorder=3)
        ax2.bar(["NEW"], [new_pct[i]], bottom=[bottoms_new[i]],
                color=colors[i], width=0.5, zorder=3)

    for bottoms, pcts, counts in [(bottoms_old, old_pct, old_counts),
                                    (bottoms_new, new_pct, new_counts)]:
        col = "OLD" if bottoms is bottoms_old else "NEW"
        for i in range(3):
            ax2.text(col, bottoms[i] + pcts[i] / 2, f"{pcts[i]:.0f}%",
                      ha="center", va="center", fontsize=10.5,
                      fontweight="bold", color="white")

    ax2.set_ylim(0, 100)
    ax2.set_yticks([0, 25, 50, 75, 100])
    ax2.set_yticklabels(["0%", "25%", "50%", "75%", "100%"])
    ax2.grid(True, axis="y", color=RULE, linewidth=0.7, alpha=0.7)
    ax2.set_axisbelow(True)
    ax2.set_title("Split proportion — unchanged", fontsize=13.5,
                   fontweight="bold", color=INK, pad=10, loc="left")

    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in colors]
    ax2.legend(handles, labels, frameon=False, fontsize=10.5,
               labelcolor=INK_2, loc="upper center",
               bbox_to_anchor=(0.5, -0.08), ncol=3)

    fig.suptitle("Train / validation / test split — old vs. new",
                  fontsize=18, fontweight="bold", color=INK,
                  y=1.06, x=0.015, ha="left")
    fig.text(0.015, 1.005,
              "Split by issue date, oldest to newest — 10× the rows, "
              "same 70/15/15 shape.",
              fontsize=10.5, color=MUTED, ha="left")

    fig.tight_layout(rect=[0, 0, 1, 0.90])
    out = BASE_DIR / "train_test_split.png"
    fig.savefig(out, facecolor=PAPER, bbox_inches="tight")
    print(f"saved -> {out}")


if __name__ == "__main__":
    make_dataset_comparison()
    make_train_test_split()
