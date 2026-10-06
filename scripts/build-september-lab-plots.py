"""Export the article's recorded observations with matplotlib.

Run with an isolated plotting environment:
    uv run --no-project --with matplotlib scripts/build-september-lab-plots.py

The source JSON retains the measured points and their provenance. This script
does not fit, smooth, interpolate additional measurements, or estimate errors.
"""

import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, MultipleLocator

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/data/september-lab.json"
GPU_SOURCE = ROOT / "src/data/september-gpu-runs.json"
OUTPUT = ROOT / "public/articles/a-month-of-teaching-a-model-to-talk"
PREVIEWS = ROOT / "work/september-lab/plot-previews"

BACKGROUND = "#1d1d1c"
TEXT = "#e3e1db"
MUTED = "#bdbbb5"
SUBTLE = "#a6a39c"
ACCENT = "#c59178"
BORDER = "#41413e"

plt.rcParams.update(
    {
        "figure.facecolor": BACKGROUND,
        "axes.facecolor": BACKGROUND,
        "savefig.facecolor": BACKGROUND,
        "font.family": "DejaVu Sans Mono",
        "font.size": 10,
        "text.color": TEXT,
        "axes.labelcolor": MUTED,
        "axes.edgecolor": BORDER,
        "xtick.color": SUBTLE,
        "ytick.color": SUBTLE,
        "grid.color": BORDER,
        "grid.linestyle": (0, (2, 4)),
        "grid.linewidth": 0.6,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "svg.fonttype": "none",
    }
)


def export(fig, name, title, description):
    metadata = {
        "Title": title,
        "Description": description,
        "Creator": "matplotlib; measurements from Bernhard Hauke's September learning notes",
        "Date": None,
    }
    svg_path = OUTPUT / f"{name}.svg"
    fig.savefig(svg_path, metadata=metadata)
    svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines()) + "\n")
    fig.savefig(PREVIEWS / f"{name}.png", dpi=150)
    plt.close(fig)


def save_csv(name, fields, rows):
    with (OUTPUT / f"{name}.csv").open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def character_plot(data):
    run = data["characterRun"]
    points = run["points"]
    fig, ax = plt.subplots(figsize=(8, 4.6))
    fig.subplots_adjust(left=0.10, right=0.96, bottom=0.18, top=0.81)
    fig.text(0.10, 0.91, "Character-model training", fontsize=15, color=TEXT)
    steps = [point["step"] for point in points]
    ax.plot(steps, [point["train"] for point in points], label="Training split", color=SUBTLE, linestyle=(0, (5, 4)), marker="s", markersize=3.2, linewidth=1.6)
    ax.plot(steps, [point["validation"] for point in points], label="Validation split", color=ACCENT, marker="o", markersize=3.4, linewidth=1.8)
    ax.set_xlim(0, 5000)
    ax.set_ylim(1, 5.5)
    ax.set_xlabel("Optimizer update", labelpad=10)
    ax.set_ylabel("Cross-entropy per character", labelpad=12)
    ax.xaxis.set_major_locator(MultipleLocator(1000))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{int(value):,}"))
    ax.yaxis.set_major_locator(MultipleLocator(1))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:.1f}"))
    ax.tick_params(length=4, pad=7)
    ax.grid(axis="y")
    legend = ax.legend(loc="upper right", frameon=False, fontsize=9)
    for text in legend.get_texts():
        text.set_color(MUTED)
    fig.text(0.10, 0.03, "Lines join recorded training and validation estimates.", fontsize=8, color=MUTED)
    export(fig, "character-loss", "September 20 character-model loss", "Twenty recorded evaluations, update 0 through 4,750. Natural-log cross-entropy per character. Both training and validation estimates use evaluation mode; each averages 20 sampled batches. Lines connect recorded points, without smoothing. Source: " + run["source"])
    save_csv("character-loss", ["step", "train", "validation"], points)


def width_plot(data):
    notes = data["widthNotes"]
    fig, ax = plt.subplots(figsize=(8, 4.8))
    fig.subplots_adjust(left=0.12, right=0.96, bottom=0.32, top=0.74)
    fig.text(0.12, 0.85, "Notebook width comparison", fontsize=15, color=TEXT)
    for index, point in enumerate(notes["points"]):
        row = 1 - index
        ax.plot([point["train"], point["validation"]], [row, row], color=BORDER, linewidth=2)
        ax.plot(point["train"], row, marker="o", markersize=6, markerfacecolor=BACKGROUND, markeredgecolor=SUBTLE, markeredgewidth=1.5, linestyle="none", label="Training" if index == 0 else None)
        ax.plot(point["validation"], row, marker="o", markersize=6, color=ACCENT, linestyle="none", label="Validation" if index == 0 else None)
        ax.annotate(f"{point['train']:.3f}", (point["train"], row), xytext=(0, 13), textcoords="offset points", ha="center", color=TEXT)
        ax.annotate(f"{point['validation']:.3f}", (point["validation"], row), xytext=(0, -22), textcoords="offset points", ha="center", color=ACCENT)
    baseline = notes["baselineValidationApproximate"]
    ax.axvline(baseline, color=SUBTLE, linewidth=0.7, linestyle=(0, (3, 5)), alpha=0.7)
    ax.annotate("Earlier val. ≈2.164", (baseline, 1.5), xytext=(-5, 0), textcoords="offset points", ha="right", va="bottom", color=SUBTLE, fontsize=8)
    ax.set_xlim(1.7, 2.25)
    ax.set_ylim(-0.65, 1.65)
    ax.set_yticks([1, 0], ["32", "64"])
    ax.set_ylabel("Hidden width", labelpad=14)
    ax.set_xlabel("Cross-entropy per character · lower is better", labelpad=12)
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0, pad=10)
    ax.tick_params(axis="x", length=4, pad=7)
    ax.xaxis.set_major_locator(MultipleLocator(0.1))
    legend = ax.legend(loc="lower left", bbox_to_anchor=(0, -0.53), frameon=False, ncol=2, fontsize=9)
    for text in legend.get_texts():
        text.set_color(MUTED)
    fig.text(0.12, 0.06, "Rounded notebook notes; approximate earlier baseline. No controlled-run or uncertainty claim.", fontsize=7.5, color=MUTED)
    export(fig, "width-comparison", "Notebook width comparison", "Saved WaveNet-style names-model notes. Hidden width 32: training 1.981, validation 2.058. Width 64: training 1.816, validation 2.017. Earlier unscaled validation approximately 2.164. These notebook observations are not a controlled benchmark. Source: " + notes["source"])
    save_csv("width-comparison", ["width", "train", "validation"], notes["points"])


def fineweb_plot(data):
    runs = sorted((run for run in data.values() if "validation" in run), key=lambda run: run["preparedTrainingTokens"])
    larger = next(run for run in runs if run["preparedTrainingTokens"] == 500_000_000)
    final_validation = larger["validation"][-1]
    losses = [point["loss"] for run in runs for point in run["validation"]]
    fig, ax = plt.subplots(figsize=(8, 4.6))
    fig.subplots_adjust(left=0.10, right=0.96, bottom=0.18, top=0.81)
    fig.text(0.10, 0.91, "The completed FineWeb-Edu run", fontsize=15, color=TEXT)
    rows = []
    for run in runs:
        is_larger = run["preparedTrainingTokens"] == 500_000_000
        label = f"{run['preparedTrainingTokens'] // 1_000_000}M corpus"
        color = ACCENT if is_larger else SUBTLE
        points = run["validation"]
        is_reported = run["provenance"]["kind"] == "author_reported_final_log_excerpt"
        ax.plot([point["processedTokenPositions"] / 1_000_000 for point in points], [point["loss"] for point in points], label="100M reported endpoint" if is_reported else f"{label} · validation", color=color, linestyle="none" if len(points) == 1 else "-" if is_larger else (0, (5, 4)), linewidth=1.8, marker="o" if is_larger else "s", markersize=6 if is_reported else 2.3, markerfacecolor=BACKGROUND if is_reported else color, markeredgewidth=1.3 if is_reported else 0.5)
        last = points[-1]
        if is_reported:
            ax.annotate("100M endpoint", (last["processedTokenPositions"] / 1_000_000, last["loss"]), xytext=(12, 14), textcoords="offset points", color=SUBTLE, fontsize=8)
        else:
            ax.plot(last["processedTokenPositions"] / 1_000_000, last["loss"], color=color, marker="o" if is_larger else "s", markersize=5)
        rows.extend({"run": label, "prepared_training_tokens": run["preparedTrainingTokens"], "logged_step": point["update"], "completed_updates": point["update"] + 1, "processed_token_positions": point["processedTokenPositions"], "validation_loss": point["loss"], "source_kind": run["provenance"]["kind"]} for point in points)
    ax.set_xlim(0, 500)
    ax.set_ylim(int(min(losses)), int(max(losses)) + 1)
    ax.set_xlabel("Processed training token positions", labelpad=10)
    ax.set_ylabel("Cross-entropy per GPT-2 token", labelpad=12)
    ax.xaxis.set_major_locator(MultipleLocator(100))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: "0" if value == 0 else f"{int(value)}M"))
    ax.yaxis.set_major_locator(MultipleLocator(1))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:.1f}"))
    ax.tick_params(length=4, pad=7)
    ax.grid(axis="y")
    legend = ax.legend(loc="upper right", frameon=False, fontsize=9)
    for text in legend.get_texts():
        text.set_color(MUTED)
    fig.text(0.10, 0.03, "Curve: saved training log. Square: earlier reported endpoint. Both use the same held-out text.", fontsize=7.5, color=MUTED)
    sources = "; ".join(run["provenance"].get("logFilename", "author's final 100M log excerpt") for run in runs)
    export(fig, "fineweb-loss", "FineWeb-Edu GPU validation loss", f"Recorded validation losses from {len(runs)} FineWeb-Edu training run(s). The 100M observation is one author-reported final endpoint at 98304000 positions / validation 4.623868, shown as a square without a learning curve. The 500M run has 153 saved validation estimates. Every validation point occurs after its optimizer update; processed positions = (logged step + 1) * 32768. No initial validation point, smoothing, or synthetic measurements. The larger run completes {larger['optimizerUpdates']} updates, processes {larger['processedTokenPositions']} token positions, and finishes at validation {final_validation['loss']:.6f}. Natural-log cross-entropy per GPT-2 token. Both runs evaluate the same held-out data, with different training horizons. Training and validation estimates use different batches. Sources: {sources}.")
    save_csv("fineweb-loss", ["run", "prepared_training_tokens", "logged_step", "completed_updates", "processed_token_positions", "validation_loss", "source_kind"], rows)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    data = json.loads(SOURCE.read_text())
    character_plot(data)
    width_plot(data)
    fineweb_plot(json.loads(GPU_SOURCE.read_text()))
    print(f"Exported three SVG plots and their CSV observations to {OUTPUT}")


if __name__ == "__main__":
    main()
