import { LearningFigure } from "./LearningFigure";
import { predictionExample } from "../lib/prediction-lesson";
import { escapeHTML } from "../lib/tensor-math";
import record from "../data/first-transformer-run.json";

const figureStyles = `<style>
.bars{max-width:440px;margin:16px auto}.bar-row{display:grid;grid-template-columns:70px minmax(60px,1fr) 56px;gap:12px;align-items:center;margin:8px 0}.track{height:12px;background:var(--line);border-radius:3px;overflow:hidden}.fill{height:100%;background:var(--accent);border-radius:3px}.percent{text-align:right;font-variant-numeric:tabular-nums}.prompt{font-size:13px;line-height:1.9;max-width:440px;margin:0 auto 14px;white-space:normal;color:var(--ink)}.record-controls{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}select{background:var(--surface,#232321);color:var(--ink);border:1px solid var(--line);border-radius:4px;max-width:100%;padding:6px}.metrics{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-top:16px}.metric{font-size:11px;color:var(--quiet)}.metric output{color:var(--ink)}.controls input[type=range]{width:200px;max-width:100%}.trace{min-height:50px;text-align:center;color:var(--quiet);margin-top:12px} .trace output{color:var(--ink)}
</style>`;
const bars = (labels: string[]) =>
  `<div class="bars">${labels.map((label, i) => `<div class="bar-row"><span>${escapeHTML(label)}</span><div class="track"><div class="fill" data-bar="${i}"></div></div><output class="percent" data-percent="${i}"></output></div>`).join("")}</div>`;

class PredictionLab extends LearningFigure {
  protected setup() {
    let score = Math.log(2);
    this.mount(
      `${figureStyles}<p class="hint">The correct next token is blue. Red and green keep a score of 0.</p>${bars(["blue", "red", "green"])}<div class="controls"><label>Blue's score <input aria-label="Blue's score" type="range" min="-4" max="8" step="0.01" value="${score}"></label><output data-score></output></div><div class="metrics"><span class="metric">Loss <output data-loss></output></span><span class="metric">Slope <output data-gradient></output></span></div><div class="controls"><button class="primary" data-step>Take one learning step</button><button data-reset>Reset</button></div><p class="trace" aria-live="polite" data-trace>Move the score, or update it using its loss gradient. Learning rate: 0.5.</p>`,
      "Same softmax, same loss, one adjustable parameter. The bars always use the same scale.",
    );
    const update = () => {
      const result = predictionExample(score);
      result.probabilities.forEach((p, i) => {
        this.find(`[data-bar="${i}"]`).setAttribute(
          "style",
          `width:${p * 100}%`,
        );
        this.find(`[data-percent="${i}"]`).textContent =
          `${(p * 100).toFixed(2)}%`;
      });
      this.find("[data-score]").textContent = score.toFixed(3);
      this.find("[data-loss]").textContent = result.loss.toFixed(3);
      this.find("[data-gradient]").textContent = result.gradient.toFixed(3);
      this.find<HTMLInputElement>("input").value = String(score);
      this.find<HTMLButtonElement>("[data-step]").disabled =
        score - 0.5 * result.gradient > 8;
    };
    this.on("input", () => {
      score = Number(this.find<HTMLInputElement>("input").value);
      this.find("[data-trace]").textContent =
        "The slope tells us how the loss responds to a small increase in blue’s score.";
      update();
    });
    this.on("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-reset]")) {
        score = Math.log(2);
        this.find("[data-trace]").textContent =
          "Reset: probabilities 1/2, 1/4, 1/4. Learning rate: 0.5.";
      } else if (event.target.closest("[data-step]")) {
        const previous = score,
          gradient = predictionExample(score).gradient;
        score -= 0.5 * gradient;
        this.find("[data-trace]").textContent =
          `${previous.toFixed(3)} − 0.5 × (${gradient.toFixed(3)}) ≈ ${score.toFixed(3)}. Other scores stay fixed.`;
      } else return;
      update();
    });
    update();
  }
}

class TransformerRecord extends LearningFigure {
  protected setup() {
    const final = record.history.at(-1)!;
    if (this.hasAttribute("training")) {
      const width = 420,
        height = 210;
      const px = (step: number) => 44 + (step / record.steps) * 360;
      this.mount(
        `${figureStyles}<div class="record-controls"><label>Measure <select aria-label="Training measurement"><option value="accuracy">Answer accuracy</option><option value="loss">Token loss</option></select></label></div><svg class="plot" viewBox="0 0 ${width} ${height}" role="img"><path class="axis" d="M44,24 V178 H404"/><text x="12" y="182" data-min></text><text x="4" y="36" data-max></text><text x="44" y="200">0</text><text x="328" y="200">${record.steps.toLocaleString()} steps</text><path class="curve" data-train/><path class="accent-stroke" data-validation/></svg><p class="legend">gray: training · peach: held-out mappings</p><div class="metrics"><span class="metric">Final held-out accuracy <output>${(100 * final.validation.accuracy).toFixed(1)}%</output></span><span class="metric">Final held-out loss <output>${final.validation.loss.toFixed(3)}</output></span></div><details><summary>Recorded measurements</summary><div class="table-scroll"><table><thead><tr><th>Step</th><th>Train answers</th><th>Held-out answers</th><th>Train loss</th><th>Held-out loss</th></tr></thead><tbody>${record.history
          .filter(
            (point) => point.step % 2000 === 0 || point.step === record.steps,
          )
          .map(
            (point) =>
              `<tr><td>${point.step}</td><td>${(point.train.accuracy * 100).toFixed(1)}%</td><td>${(point.validation.accuracy * 100).toFixed(1)}%</td><td>${point.train.loss.toFixed(3)}</td><td>${point.validation.loss.toFixed(3)}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div></details>`,
        "One recorded CPU run. Accuracy counts the highest-probability answer over the entire vocabulary; it is not sampled accuracy.",
      );
      const updatePlot = () => {
        const metric =
          this.find<HTMLSelectElement>("select").value === "loss"
            ? "loss"
            : "accuracy";
        const maximum =
          metric === "accuracy"
            ? 1
            : Math.ceil(
                Math.max(
                  ...record.history.flatMap((point) => [
                    point.train.loss,
                    point.validation.loss,
                  ]),
                ) * 2,
              ) / 2;
        this.find("[data-min]").textContent =
          metric === "accuracy" ? "0%" : "0";
        this.find("[data-max]").textContent =
          metric === "accuracy" ? "100%" : String(maximum);
        for (const split of ["train", "validation"] as const) {
          const path = record.history
            .map(
              (point, i) =>
                `${i ? "L" : "M"}${px(point.step)},${178 - (point[split][metric] / maximum) * 146}`,
            )
            .join(" ");
          this.find(`[data-${split}]`).setAttribute("d", path);
        }
        this.find("svg").setAttribute(
          "aria-label",
          `Training and held-out ${metric === "accuracy" ? "answer accuracy" : "average token loss"} over ${record.steps} updates. Open Recorded measurements for the values.`,
        );
      };
      this.on("change", updatePlot);
      updatePlot();
      return;
    }
    let selected = 0,
      trained = true;
    const options = [
      "Original facts",
      "Change Mira’s color",
      "Change the other fact",
      "Reverse fact order",
      "Ask about Nori",
    ];
    this.mount(
      `${figureStyles}<p class="prompt" data-prompt></p><div class="record-controls"><label>Example <select aria-label="Recorded example">${options.map((label, i) => `<option value="${i}">${label}</option>`).join("")}</select></label><button data-toggle>Before training</button></div>${bars(["blue", "red", "green", "gold", "other"])}<p class="readout" aria-live="polite" data-status></p>`,
      "Actual probabilities recorded from the accompanying Python model. These are saved evaluations, not a model running in your browser.",
    );
    const update = () => {
      const sample = (trained ? record.after : record.before)[selected];
      this.find("[data-prompt]").textContent =
        sample.prompt.replace("<start> ", "") + " …";
      const probs = sample.probabilities.slice(6, 10);
      const other = sample.probabilities.reduce(
        (sum, p, i) => sum + (i < 6 || i >= 10 ? p : 0),
        0,
      );
      [...probs, other].forEach((p, i) => {
        this.find(`[data-bar="${i}"]`).setAttribute(
          "style",
          `width:${100 * p}%`,
        );
        this.find(`[data-percent="${i}"]`).textContent =
          `${(p * 100).toFixed(2)}%`;
      });
      this.find("[data-toggle]").textContent = trained
        ? "Before training"
        : "After training";
      this.find("[data-status]").textContent =
        `${trained ? `${record.steps.toLocaleString()} updates` : "Random initialization"} · ${sample.split} mapping · same weights for all examples at this stage`;
    };
    this.on("change", () => {
      selected = Number(this.find<HTMLSelectElement>("select").value);
      update();
    });
    this.on("click", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-toggle]")
      ) {
        trained = !trained;
        update();
      }
    });
    update();
  }
}
if (!customElements.get("prediction-lab"))
  customElements.define("prediction-lab", PredictionLab);
if (!customElements.get("transformer-record"))
  customElements.define("transformer-record", TransformerRecord);
