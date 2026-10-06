import { LearningFigure } from "./LearningFigure";
import { fieldStep, vectorFieldExample } from "../lib/vector-field";
import type { Vector2 } from "../lib/neural-examples";
import { escapeHTML, latex } from "../lib/tensor-math";
import styles from "../styles/vector-field.css?inline";

const format = (number: number) => String(Number(number.toFixed(3)));
const coordinates = (vector: Vector2) => `[${vector.map(format).join(", ")}]`;

/** A true two-coordinate loss field, rather than a projection of trained weights. */
class VectorField extends LearningFigure {
  protected setup() {
    const example = vectorFieldExample({
      mode: this.getAttribute("mode"),
      initial: this.json("initial", undefined),
      vectors: this.json("vectors", undefined),
      values: this.json("values", undefined),
      target: this.json("target", undefined),
      labels: this.json("labels", undefined),
      extent: this.getAttribute("extent") ?? undefined,
      rate: this.getAttribute("rate") ?? undefined,
    });
    const { mode, initial, extent, rate, evaluate, labels } = example;
    const symbol = mode === "embedding" ? "e" : "q";
    const description = mode === "embedding" ? "Embedding" : "Query";
    let current: Vector2 = [...initial];
    let history: Vector2[] = [[...initial]];
    let step = 0;
    const unit = 116 / extent;
    const point = ([x, y]: Vector2): Vector2 => [
      160 + x * unit,
      150 - y * unit,
    ];
    const arrow = (from: Vector2, to: Vector2, head: number) => {
      const dx = to[0] - from[0],
        dy = to[1] - from[1];
      const length = Math.hypot(dx, dy);
      if (length < 0.00001) return "";
      const ux = dx / length,
        uy = dy / length;
      const h = Math.min(head, length * 0.4);
      return `M${from} L${to} M${to[0] - h * ux + h * 0.5 * uy},${to[1] - h * uy - h * 0.5 * ux} L${to} L${to[0] - h * ux - h * 0.5 * uy},${to[1] - h * uy + h * 0.5 * ux}`;
    };
    const field: string[] = [];
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        const position: Vector2 = [(col * extent) / 3.6, (row * extent) / 3.6];
        const { gradient } = evaluate(position);
        const length = Math.hypot(...gradient);
        if (length < 1e-9) continue;
        const center = point(position);
        const dx = (-gradient[0] / length) * 7,
          dy = (gradient[1] / length) * 7;
        field.push(
          arrow(
            [center[0] - dx, center[1] - dy],
            [center[0] + dx, center[1] + dy],
            4,
          ),
        );
      }
    }
    const targetText =
      example.mode === "embedding"
        ? `One embedding row · next token: ${escapeHTML(labels[example.target])}`
        : `One query · desired output: ${coordinates(example.target)}`;
    const details =
      example.mode === "embedding"
        ? `<p>Only this embedding row changes. The readout weights and other embedding rows stay fixed. The two axes are the row’s two coordinates, not named meanings.</p><p>${latex("z_i=e\\cdot w_i,\\quad p=\\operatorname{softmax}(z),\\quad L=-\\ln p_{\\mathrm{target}}")}</p><p>${latex("\\nabla_e L=\\sum_i(p_i-y_i)w_i")}</p><p>Here y is 1 for the target and 0 for the other tokens.</p><div class="table-scroll"><table><thead><tr><th>Next token</th><th>Fixed readout vector</th></tr></thead><tbody>${example.vectors.map((v, i) => `<tr><td>${escapeHTML(labels[i])}</td><td>${coordinates(v)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p>For this exercise, q is adjustable; keys and values stay fixed. A full transformer backpropagates this gradient into the weights and inputs that produced q. It does not store and optimize q as a parameter.</p><p>${latex("s_i=\\frac{q\\cdot k_i}{\\sqrt 2},\\quad a=\\operatorname{softmax}(s),\\quad o=\\sum_i a_i v_i")}</p><p>${latex("L=\\tfrac12\\lVert o-t\\rVert^2,\\quad \\nabla_q L=\\frac{1}{\\sqrt 2}\\sum_i a_i[(o-t)\\cdot(v_i-o)]k_i")}</p><p>The gradient follows the output error backward through the mixture, softmax, and dot products. It is not a direct instruction to match a particular key.</p><div class="table-scroll"><table><thead><tr><th>Source</th><th>Fixed key</th><th>Fixed value</th></tr></thead><tbody>${example.vectors.map((v, i) => `<tr><td>${escapeHTML(labels[i])}</td><td>${coordinates(v)}</td><td>${coordinates(example.values[i])}</td></tr>`).join("")}</tbody></table></div>`;
    this.mount(
      `<style>${styles}</style><p class="field-title">${targetText}</p><svg class="plot field-plot" data-plot viewBox="0 0 320 304" role="group" aria-label="${description} vector and downhill directions in its two-coordinate loss field"><path class="axis" d="M34 150H286 M160 24V276"/><text x="294" y="145">${symbol}₁</text><text x="169" y="26">${symbol}₂</text><text x="148" y="166" text-anchor="end">0</text><text x="44" y="166" text-anchor="middle">−${extent}</text><text x="276" y="166" text-anchor="middle">${extent}</text><g class="directions" data-field aria-hidden="true"><path d="${field.join(" ")}"/></g><path class="field-trail" data-trail/><circle class="field-start" data-start r="3"/><path class="accent-stroke field-vector" data-vector/><g class="field-handle" data-handle role="button" tabindex="0"><circle class="query-hit" r="16"/><circle class="accent-fill field-point" r="4.5"/><text data-label x="9" y="-10">${symbol}</text></g></svg><p class="hint">Small arrows show downhill direction, not step length.</p><div class="field-context"><span>${symbol} = <output data-coordinates></output></span><span>loss <output data-loss></output></span></div>${mode === "attention" ? '<p class="readout">mixture = <output data-output></output></p>' : ""}<div class="field-probabilities" aria-label="${mode === "embedding" ? "Next-token probabilities" : "Attention weights"}">${labels.map((label, i) => `<span data-target="${example.mode === "embedding" && i === example.target}">${escapeHTML(label)}<output data-weight="${i}"></output></span>`).join("")}</div><div class="controls"><button class="primary" data-step>Take one step</button><button data-reset>Reset</button></div><p class="field-update" data-update role="status" aria-live="polite"></p><details class="field-details" ${this.hasAttribute("compact") ? "hidden" : ""}><summary>Details</summary><p>Drag the point to choose a new starting vector, or focus it and use arrow keys. Shift uses larger increments. Moving it clears the previous trail.</p><label><input type="checkbox" data-directions checked>Show downhill directions</label>${details}<p>${latex(`${symbol}_{\\mathrm{new}}=${symbol}-${rate}\\,\\nabla_${symbol}L`)}</p><p data-gradient></p><p>The axes and learning rate stay fixed. Steps that leave this view are stopped, not clipped. The field shows directions for this fixed example; real training combines many examples and changes other parameters too.</p></details>`,
      mode === "embedding"
        ? "A prediction error changes an embedding through its gradient. These are two actual coordinates of a small teaching model."
        : "The output error gives the query a direction to change. This isolates one part of attention’s backward calculation.",
    );
    const inside = (vector: Vector2) =>
      vector.every((n) => Number.isFinite(n) && Math.abs(n) <= extent);
    let message =
      "Take a gradient step, or drag the point to start somewhere else.";
    const update = () => {
      const result = evaluate(current);
      const xy = point(current);
      this.find("[data-vector]").setAttribute("d", arrow(point([0, 0]), xy, 7));
      this.find("[data-handle]").setAttribute("transform", `translate(${xy})`);
      this.find("[data-handle]").setAttribute(
        "aria-label",
        `${description} ${coordinates(current)}. Use arrow keys to move.`,
      );
      this.find("[data-label]").setAttribute(
        "x",
        current[0] > extent * 0.75 ? "-14" : "9",
      );
      this.find("[data-label]").setAttribute(
        "y",
        current[1] > extent * 0.75 ? "17" : "-10",
      );
      const start = point(history[0]);
      this.find("[data-start]").setAttribute("cx", String(start[0]));
      this.find("[data-start]").setAttribute("cy", String(start[1]));
      this.find("[data-start]").setAttribute(
        "visibility",
        history.length > 1 ? "visible" : "hidden",
      );
      this.find("[data-trail]").setAttribute(
        "d",
        history.map((v, i) => `${i ? "L" : "M"}${point(v)}`).join(" "),
      );
      this.find("[data-coordinates]").textContent = coordinates(current);
      this.find("[data-loss]").textContent = format(result.loss);
      this.find("[data-gradient]").textContent =
        `Current gradient: ${coordinates(result.gradient)}. Learning rate: ${rate}.`;
      result.weights.forEach((weight, i) => {
        this.find(`[data-weight="${i}"]`).textContent =
          `${(weight * 100).toFixed(1)}%`;
      });
      if (result.output)
        this.find("[data-output]").textContent = coordinates(result.output);
      const outside = !inside(fieldStep(current, result.gradient, rate));
      const settled = Math.hypot(...result.gradient) < 1e-8;
      this.find<HTMLButtonElement>("[data-step]").disabled = outside || settled;
      this.find("[data-update]").textContent = outside
        ? "The next step would leave these fixed axes. Reset or move the point inward."
        : settled
          ? "The gradient is zero at the displayed precision. Move the point to explore."
          : message;
    };
    const restart = (position: Vector2) => {
      current = position;
      history = [[...position]];
      step = 0;
      message = "New starting vector. Take one step to follow its gradient.";
      update();
    };
    this.on("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-reset]")) return restart([...initial]);
      if (!event.target.closest("[data-step]")) return;
      const result = evaluate(current);
      const next = fieldStep(current, result.gradient, rate);
      if (!inside(next)) return;
      current = next;
      history.push([...current]);
      if (history.length > 100) history.splice(1, 1);
      step++;
      message = `Step ${step}: loss ${format(result.loss)} → ${format(evaluate(current).loss)}. Each coordinate subtracts ${rate} × its gradient.`;
      update();
    });
    this.on("change", () =>
      this.find("[data-field]").setAttribute(
        "visibility",
        this.find<HTMLInputElement>("[data-directions]").checked
          ? "visible"
          : "hidden",
      ),
    );
    const svg = this.find<SVGSVGElement>("[data-plot]");
    let pointer: number | null = null;
    const move = (event: PointerEvent) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      restart([
        Math.max(-extent, Math.min(extent, (local.x - 160) / unit)),
        Math.max(-extent, Math.min(extent, (150 - local.y) / unit)),
      ]);
    };
    this.on("pointerdown", (event) => {
      if (
        !(event instanceof PointerEvent) ||
        !(event.target instanceof Element) ||
        !event.target.closest("[data-handle]")
      )
        return;
      event.preventDefault();
      pointer = event.pointerId;
      svg.setPointerCapture(pointer);
      this.find<SVGElement>("[data-handle]").focus();
      move(event);
    });
    this.on("pointermove", (event) => {
      if (event instanceof PointerEvent && event.pointerId === pointer)
        move(event);
    });
    const release = (event: Event) => {
      if (!(event instanceof PointerEvent) || event.pointerId !== pointer)
        return;
      if (svg.hasPointerCapture(pointer)) svg.releasePointerCapture(pointer);
      pointer = null;
    };
    this.on("pointerup", release);
    this.on("pointercancel", release);
    this.on("lostpointercapture", release);
    this.on("keydown", (event) => {
      if (
        !(event instanceof KeyboardEvent) ||
        !(event.target instanceof Element) ||
        !event.target.closest("[data-handle]")
      )
        return;
      const delta = (
        {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, 1],
          ArrowDown: [0, -1],
        } as Record<string, Vector2>
      )[event.key];
      if (!delta) return;
      event.preventDefault();
      const distance = event.shiftKey ? 0.5 : 0.1;
      restart(
        current.map((value, i) =>
          Math.max(-extent, Math.min(extent, value + delta[i] * distance)),
        ) as Vector2,
      );
    });
    update();
  }
}
if (!customElements.get("vector-field"))
  customElements.define("vector-field", VectorField);
