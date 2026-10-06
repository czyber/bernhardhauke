import { LearningFigure } from "./LearningFigure";
import {
  embeddingNextTokens,
  embeddingToyCorpus,
  embeddingTrainingHistory,
} from "../lib/embedding-training";
import type { EmbeddingPoint } from "../lib/embedding-training";

const styles = `<style>
.training-demo{max-width:520px;margin-inline:auto}.training-plot{width:100%;max-width:520px}.training-plot text{font-size:12px}.word{cursor:pointer}.word .point{fill:var(--accent)}.word .hit{fill:transparent}.word text{fill:var(--ink)}.word[aria-pressed="true"] text{font-weight:bold;fill:var(--accent)}.trail{stroke:var(--quiet);stroke-width:1;fill:none;opacity:.42}.trail[data-active="true"]{stroke:var(--accent);opacity:.8;stroke-width:1.7}.label-link{stroke:var(--line);stroke-width:1;fill:none}.word:focus-visible{outline:none}.word:focus-visible .point{stroke:var(--ink);stroke-width:2}.training-progress{width:100%;display:grid;grid-template-columns:auto minmax(80px,1fr) auto;gap:10px}.training-progress input{width:100%;max-width:none}.training-metrics{display:flex;justify-content:space-between;gap:16px;color:var(--quiet);margin:12px 0;font-size:11px;font-variant-numeric:tabular-nums}.training-metrics output{color:var(--ink)}.selected-vector{font:16px/1.6 var(--font-copy,Georgia,serif);margin:18px 0 10px}.selected-vector output{font:12px var(--font-mono,monospace);color:var(--accent)}.next-probabilities{margin-bottom:20px}.next-row{display:grid;grid-template-columns:70px minmax(60px,1fr) 54px;align-items:center;gap:10px;margin:8px 0;font-size:11px;font-variant-numeric:tabular-nums}.next-row output{text-align:right}.probability-track{height:8px;background:var(--line)}.probability-fill{height:100%;background:var(--accent)}.corpus-title{color:var(--quiet);font-size:11px;margin:18px 0 8px}.corpus{font-size:11px;line-height:1.9;color:var(--quiet)}.corpus p[data-active="true"]{color:var(--accent)}.training-note{font:15px/1.6 var(--font-copy,Georgia,serif);color:var(--quiet);margin-top:18px}
:host([bare]) .selected-vector,:host([bare]) .next-probabilities,:host([bare]) .corpus-title,:host([bare]) .corpus,:host([bare]) .training-note,:host([bare]) .training-metrics>span+span{display:none}:host([bare]) .training-metrics{justify-content:center;margin:0 0 8px}
</style>`;

class EmbeddingTraining extends LearningFigure {
  protected setup() {
    const history = embeddingTrainingHistory();
    const lastStep = history.length - 1;
    const extent =
      Math.ceil(
        Math.max(
          ...history.flatMap((snapshot) =>
            snapshot.embeddings.flat().map(Math.abs),
          ),
        ) *
          1.12 *
          2,
      ) / 2;
    const unit = 145 / extent;
    const pixel = ([x, y]: EmbeddingPoint): EmbeddingPoint => [
      250 + x * unit,
      190 - y * unit,
    ];
    let step = 0;
    let selected = 0;
    let playing = false;
    let animation: number | null = null;
    let lastTime = 0;
    this.mount(
      `${styles}<div class="training-demo">
      <svg class="plot training-plot" viewBox="0 0 500 390" role="group" aria-label="Six learned two-coordinate embeddings with training trajectories">
      <path class="axis" d="M105 190H395 M250 45V335"/><text x="105" y="210" text-anchor="middle">−${extent}</text><text x="395" y="210" text-anchor="middle">${extent}</text><text x="240" y="52" text-anchor="end">${extent}</text><text x="240" y="338" text-anchor="end">−${extent}</text><text x="240" y="207" text-anchor="end">0</text><text x="250" y="377" text-anchor="middle">embedding coordinate 1</text><text transform="translate(35 190) rotate(-90)" text-anchor="middle">embedding coordinate 2</text>
      ${embeddingToyCorpus.map((_, index) => `<path class="trail" data-trail="${index}" aria-hidden="true"/>`).join("")}
      ${embeddingToyCorpus.map((row, index) => `<g class="word" data-word="${index}" role="button" tabindex="0" aria-pressed="false"><path class="label-link" data-link="${index}" aria-hidden="true"/><circle class="hit" data-hit="${index}" r="16"/><circle class="point" data-point="${index}" r="4"/><text data-label="${index}">${row.word}</text></g>`).join("")}
      </svg>
      <div class="training-metrics"><span>Update <output data-step></output> / ${lastStep}</span><span>Mean next-token loss <output data-loss></output></span></div>
      <div class="controls"><button class="primary" data-play>Play training</button><button data-reset>Reset</button></div>
      <label class="training-progress">Start <input data-progress type="range" min="0" max="${lastStep}" step="1" value="0" aria-label="Training update">${lastStep} updates</label>
      <p class="hint">Select a word to see its vector and next-token probabilities.</p>
      <p class="selected-vector">After <strong data-selected></strong> <output data-coordinates></output></p>
      <div class="next-probabilities" role="group" aria-label="Predicted next-token probabilities">${embeddingNextTokens.map((token, output) => `<div class="next-row"><span>${token}</span><div class="probability-track" aria-hidden="true"><div class="probability-fill" data-probability-bar="${output}"></div></div><output data-probability="${output}" aria-label="Probability of ${token}"></output></div>`).join("")}</div>
      <p class="corpus-title">Observed two-token examples · repetitions shown as counts</p>
      <div class="corpus">${embeddingToyCorpus.map((row, input) => `<p data-corpus="${input}">${row.word} → ${row.counts.flatMap((count, output) => (count ? [`${embeddingNextTokens[output]} × ${count}`] : [])).join(" · ")}</p>`).join("")}</div>
      <p class="training-note">The model learns from these 96 pairs. Each point is the two numbers in one embedding row; the trails follow actual gradient updates on fixed axes. The output weights learn too.</p>
      </div>`,
      "A two-dimensional teaching model, not a projection of my GPT-2 checkpoint.",
    );
    const update = () => {
      const snapshot = history[step];
      const labelBoxes: number[][] = [];
      snapshot.embeddings.forEach((embedding, input) => {
        const [x, y] = pixel(embedding);
        const row = embeddingToyCorpus[input];
        const width = row.word.length * 7;
        const offsets = [
          [9, -10],
          [9, 20],
          [-width - 9, -10],
          [-width - 9, 20],
          [9, -27],
          [-width - 9, -27],
          [9, 37],
          [-width - 9, 37],
        ];
        let label = [x + 9, y - 10];
        let bestScore = Infinity;
        for (const [dx, dy] of offsets) {
          const box = [x + dx, y + dy - 12, width, 16];
          const overlap = labelBoxes.reduce(
            (sum, other) =>
              sum +
              Math.max(
                0,
                Math.min(box[0] + box[2], other[0] + other[2]) -
                  Math.max(box[0], other[0]),
              ) *
                Math.max(
                  0,
                  Math.min(box[1] + box[3], other[1] + other[3]) -
                    Math.max(box[1], other[1]),
                ),
            0,
          );
          const penalty = overlap * 10 + Math.hypot(dx, dy);
          if (penalty < bestScore) {
            bestScore = penalty;
            label = [box[0], box[1] + 12];
          }
        }
        labelBoxes.push([label[0], label[1] - 12, width, 16]);
        for (const name of ["point", "hit"]) {
          this.find(`[data-${name}="${input}"]`).setAttribute("cx", String(x));
          this.find(`[data-${name}="${input}"]`).setAttribute("cy", String(y));
        }
        this.find(`[data-point="${input}"]`).setAttribute(
          "r",
          input === selected ? "5.5" : "4",
        );
        this.find(`[data-label="${input}"]`).setAttribute(
          "x",
          String(label[0]),
        );
        this.find(`[data-label="${input}"]`).setAttribute(
          "y",
          String(label[1]),
        );
        const labelEdge = label[0] < x ? label[0] + width : label[0];
        this.find(`[data-link="${input}"]`).setAttribute(
          "d",
          `M${x},${y} L${labelEdge},${label[1] - 4}`,
        );
        const word = this.find(`[data-word="${input}"]`);
        word.setAttribute("aria-pressed", String(input === selected));
        word.setAttribute(
          "aria-label",
          `${row.word}, embedding [${embedding.map((value) => value.toFixed(3)).join(", ")}]. Select to inspect next-token probabilities.`,
        );
        const trail = this.find<SVGPathElement>(`[data-trail="${input}"]`);
        trail.dataset.active = String(input === selected);
        trail.setAttribute(
          "d",
          history
            .slice(0, step + 1)
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${pixel(point.embeddings[input]).join(",")}`,
            )
            .join(" "),
        );
        this.find<HTMLElement>(`[data-corpus="${input}"]`).dataset.active =
          String(input === selected);
      });
      this.find("[data-step]").textContent = String(step);
      this.find("[data-loss]").textContent = snapshot.loss.toFixed(3);
      this.find<HTMLInputElement>("[data-progress]").value = String(step);
      this.find("[data-play]").textContent = playing
        ? "Pause"
        : step === lastStep
          ? "Replay training"
          : "Play training";
      this.find("[data-selected]").textContent =
        embeddingToyCorpus[selected].word;
      this.find("[data-coordinates]").textContent =
        `[${snapshot.embeddings[selected].map((value) => value.toFixed(3)).join(", ")}]`;
      snapshot.probabilities[selected].forEach((probability, output) => {
        this.find<HTMLElement>(
          `[data-probability-bar="${output}"]`,
        ).style.width = `${probability * 100}%`;
        this.find(`[data-probability="${output}"]`).textContent =
          `${(probability * 100).toFixed(1)}%`;
      });
    };
    const pause = () => {
      playing = false;
      if (animation !== null) cancelAnimationFrame(animation);
      animation = null;
    };
    const tick = (now: number) => {
      if (!playing) return;
      const advance = Math.floor((now - lastTime) / 20);
      if (advance > 0) {
        step = Math.min(lastStep, step + advance);
        lastTime += advance * 20;
        if (step === lastStep) pause();
        update();
      }
      if (playing) animation = requestAnimationFrame(tick);
    };
    const inspect = (target: Element) => {
      const word = target.closest<SVGElement>("[data-word]");
      if (!word) return false;
      selected = Number(word.dataset.word);
      update();
      return true;
    };
    this.on("focusin", (event) => {
      if (event.target instanceof Element) inspect(event.target);
    });
    this.on("click", (event) => {
      if (!(event.target instanceof Element) || inspect(event.target)) return;
      if (event.target.closest("[data-reset]")) {
        pause();
        step = 0;
      } else if (event.target.closest("[data-play]")) {
        if (playing) pause();
        else {
          if (step === lastStep) step = 0;
          playing = true;
          lastTime = performance.now();
          animation = requestAnimationFrame(tick);
        }
      } else return;
      update();
    });
    this.on("keydown", (event) => {
      if (
        !(event instanceof KeyboardEvent) ||
        !(event.target instanceof Element) ||
        !event.target.closest("[data-word]")
      )
        return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inspect(event.target);
      }
    });
    this.on("input", (event) => {
      if (
        !(event.target instanceof HTMLInputElement) ||
        !event.target.matches("[data-progress]")
      )
        return;
      pause();
      step = Number(event.target.value);
      update();
    });
    this.controller!.signal.addEventListener("abort", pause, { once: true });
    update();
  }
}

if (!customElements.get("embedding-training"))
  customElements.define("embedding-training", EmbeddingTraining);
