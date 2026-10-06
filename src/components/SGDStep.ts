import { LearningFigure } from "./LearningFigure";
import {
  meanLoss,
  sampleLoss,
  sampleIndex,
  sgdSamples,
  sgdStep,
} from "../lib/neural-examples";
import { latex } from "../lib/tensor-math";
import { formatTensorValue } from "../lib/tensor";

class SGDStep extends LearningFigure {
  protected setup() {
    const samples = sgdSamples(
      this.json("samples", [
        [1, 2],
        [2, 3],
        [3, 6],
      ]),
    );
    const initial = Number(this.getAttribute("weight") ?? 0);
    if (!Number.isFinite(initial) || Math.abs(initial) > 20)
      throw new Error("The initial weight must be between −20 and 20.");
    const maxRate = 1 / Math.max(...samples.map(([x]) => x * x));
    const initialRate = Number(
      this.getAttribute("rate") ?? Math.min(0.05, maxRate * 0.5),
    );
    if (
      !Number.isFinite(initialRate) ||
      initialRate <= 0 ||
      initialRate > maxRate
    )
      throw new Error(
        `Choose a learning rate above zero and at most ${formatTensorValue(maxRate)} for this example.`,
      );
    const initialSeed = Number(this.getAttribute("seed") ?? 7);
    if (
      !Number.isInteger(initialSeed) ||
      initialSeed < 0 ||
      initialSeed > 4294967295
    )
      throw new Error("Use an integer seed from 0 to 4294967295.");
    let weight = initial,
      count = 0,
      seed = initialSeed;
    const targets = [initial, ...samples.map(([x, y]) => y / x)];
    const spread = Math.max(1, Math.max(...targets) - Math.min(...targets));
    const low = Math.min(...targets) - spread * 0.2,
      high = Math.max(...targets) + spread * 0.2;
    const maxLoss =
      Math.max(meanLoss(low, samples), meanLoss(high, samples), 0.1) * 1.15;
    const px = (w: number) => 42 + ((w - low) / (high - low)) * 292;
    const py = (loss: number) => 174 - (loss / maxLoss) * 146;
    const curve = Array.from({ length: 101 }, (_, i) => {
      const w = low + (i / 100) * (high - low);
      return `${i ? "L" : "M"}${px(w).toFixed(2)},${py(meanLoss(w, samples)).toFixed(2)}`;
    }).join(" ");
    this.mount(
      `<svg class="plot" viewBox="0 0 370 220" role="img" aria-label="Average loss as a function of one weight. The point shows the current weight.">
      <path class="axis" d="M42 22 V174 H344"/><text x="42" y="14">average loss</text><text x="188" y="213" text-anchor="middle">weight w</text>
      <path class="curve" d="${curve}"/>
      <path data-travel class="accent-stroke" opacity="0.45"/>
      <circle data-before r="3" fill="var(--quiet)" visibility="hidden"/>
      <circle data-point r="5" class="accent-fill"/>
      ${[low, (low + high) / 2, high].map((w) => `<text x="${px(w)}" y="190" text-anchor="middle">${w.toFixed(1)}</text>`).join("")}
      <text x="32" y="178" text-anchor="end">0</text>
      </svg>
      <p class="readout" data-status role="status" aria-live="polite"></p>
      <div class="controls"><button class="primary" data-step>Take one step</button><button data-reset>Reset</button></div>
      <p class="hint" data-selected-sample>Sample an example to calculate its gradient.</p><div class="equation" data-update></div>
      <details><summary>Details</summary><p>Model: ${latex("\\hat y=wx")}. A step samples one training example with replacement and uses its gradient. The curve shows the average loss across all examples.</p>
      <p>${latex("\\ell_i=\\tfrac12(wx_i-y_i)^2,\\quad w_{new}=w-\\eta\\,x_i(wx_i-y_i)")}</p>
      <label>Learning rate <input data-rate type="range" min="${Math.min(initialRate, maxRate / 100)}" max="${maxRate}" step="any" value="${initialRate}" aria-label="Learning rate"><output data-rate-label></output></label>
      <p data-sample>No example sampled yet.</p><p>Displayed numbers are rounded; updates use full precision.</p>
      <div class="table-scroll"><table><thead><tr><th>Example</th><th>x</th><th>target y</th></tr></thead><tbody>${samples.map(([x, y], i) => `<tr><td>${i + 1}</td><td>${x}</td><td>${y}</td></tr>`).join("")}</tbody></table></div>
      </details>`,
      "Each step uses one sampled example to change one weight.",
    );
    const display = (value: number) => String(Number(value.toFixed(4)));
    const update = () => {
      const loss = meanLoss(weight, samples);
      const point = this.find("[data-point]");
      point.setAttribute("cx", String(px(weight)));
      point.setAttribute("cy", String(py(loss)));
      this.find("[data-status]").textContent =
        `step ${count} · w = ${display(weight)} · average loss = ${display(loss)}`;
      this.find("[data-rate-label]").textContent = display(
        Number(this.find<HTMLInputElement>("[data-rate]").value),
      );
    };
    const reset = () => {
      weight = initial;
      count = 0;
      seed = initialSeed;
      this.find<HTMLInputElement>("[data-rate]").value = String(initialRate);
      this.find("[data-before]").setAttribute("visibility", "hidden");
      this.find("[data-travel]").setAttribute("d", "");
      this.find("[data-update]").innerHTML = latex(
        "w_{new}=w-\\eta\\,\\nabla_w\\ell_i",
      );
      this.find("[data-sample]").textContent = "No example sampled yet.";
      this.find("[data-selected-sample]").textContent =
        "Sample an example to calculate its gradient.";
      update();
    };
    this.on("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-reset]")) {
        reset();
        return;
      }
      if (!event.target.closest("[data-step]")) return;
      const sampled = sampleIndex(seed, samples.length);
      seed = sampled.seed;
      const sample = samples[sampled.index];
      const rate = Number(this.find<HTMLInputElement>("[data-rate]").value);
      const result = sgdStep(weight, sample, rate);
      const before = this.find("[data-before]");
      before.setAttribute("cx", String(px(weight)));
      before.setAttribute("cy", String(py(meanLoss(weight, samples))));
      before.setAttribute("visibility", "visible");
      this.find("[data-travel]").setAttribute(
        "d",
        `M${px(weight)},${py(meanLoss(weight, samples))} L${px(result.after)},${py(meanLoss(result.after, samples))}`,
      );
      weight = result.after;
      count++;
      this.find("[data-update]").innerHTML = latex(
        `${display(result.before)} - ${display(rate)}\\,(${display(result.gradient)}) \\approx ${display(weight)}`,
      );
      this.find("[data-sample]").textContent =
        `Sample ${sampled.index + 1}: x = ${sample[0]}, y = ${sample[1]}. Sample loss before the update: ${display(sampleLoss(result.before, sample))}. Gradient: ${display(result.gradient)}.`;
      this.find("[data-selected-sample]").textContent =
        `Sampled (x = ${sample[0]}, y = ${sample[1]}) · gradient ${display(result.gradient)}`;
      update();
    });
    this.on("input", update);
    reset();
  }
}
if (!customElements.get("sgd-step")) customElements.define("sgd-step", SGDStep);
