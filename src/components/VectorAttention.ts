import { LearningFigure } from "./LearningFigure";
import { attention2, dot, vector2 } from "../lib/neural-examples";
import type { Vector2 } from "../lib/neural-examples";
import { escapeHTML, latex } from "../lib/tensor-math";

class VectorAttention extends LearningFigure {
  protected setup() {
    const mode = this.getAttribute("mode") ?? "dot";
    if (!["dot", "qkv"].includes(mode))
      throw new Error("Choose dot or qkv mode.");
    const initial = vector2(this.json("query", [1, 0.5]));
    let query: Vector2 = [...initial];
    const rawKeys = this.json(
      "keys",
      mode === "dot"
        ? [[1, 0]]
        : [
            [1, 0],
            [0, 1],
            [-1, 0],
          ],
    );
    if (
      !Array.isArray(rawKeys) ||
      rawKeys.length < 1 ||
      rawKeys.length > 4 ||
      (mode === "dot" && rawKeys.length !== 1)
    )
      throw new Error("Dot mode needs one key; QKV mode supports 1–4 keys.");
    const keys = rawKeys.map(vector2);
    const rawValues = this.json("values", [
      [1, 0],
      [0, 1],
      [-0.5, 0.5],
    ]);
    const values =
      mode === "qkv" && Array.isArray(rawValues) ? rawValues.map(vector2) : [];
    if (mode === "qkv" && values.length !== keys.length)
      throw new Error("Provide one value vector per key.");
    const labels = this.json(
      "labels",
      keys.map((_, i) => `token ${i + 1}`),
    );
    if (
      !Array.isArray(labels) ||
      labels.length !== keys.length ||
      labels.some(
        (label) =>
          typeof label !== "string" || !label.length || label.length > 32,
      )
    )
      throw new Error("Provide one short label per key.");
    const extent = Math.max(
      2,
      ...[query, ...keys, ...values].flat().map((n) => Math.abs(n) * 1.3),
    );
    const unit = 78 / extent;
    const point = ([x, y]: Vector2) => [110 + x * unit, 110 - y * unit];
    const arrow = (vector: Vector2) => {
      const [x, y] = point(vector),
        dx = x - 110,
        dy = y - 110,
        length = Math.hypot(dx, dy);
      if (length < 0.1) return "M110 110";
      const head = Math.min(7, length * 0.4),
        ux = dx / length,
        uy = dy / length;
      return `M110 110 L${x} ${y} M${x - head * ux + head * 0.5 * uy} ${y - head * uy - head * 0.5 * ux} L${x} ${y} L${x - head * ux - head * 0.5 * uy} ${y - head * uy + head * 0.5 * ux}`;
    };
    const axes =
      '<path class="axis" d="M20 110 H200 M110 20 V200"/><text x="202" y="124">x</text><text x="118" y="18">y</text><text x="98" y="124">0</text>';
    const fixedArrow = (
      vector: Vector2,
      label: string,
      index: number,
      kind: string,
    ) => {
      const [x, y] = point(vector);
      return `<g data-${kind}="${index}"><path class="vector-key" d="${arrow(vector)}"/><text x="${Math.max(8, Math.min(203, x + 7))}" y="${Math.max(14, Math.min(207, y - 7))}">${label}</text></g>`;
    };
    this.mount(
      `<div class="vector-layout"><div class="vector-panel"><p class="plot-title">${mode === "qkv" ? "Match keys" : "Two vectors"}</p>
      <svg class="plot" data-query-plot viewBox="0 0 220 220" role="group" aria-label="Query and key vectors">${axes}${keys.map((key, i) => fixedArrow(key, mode === "dot" ? "k" : `k${i + 1}`, i, "key")).join("")}
      <path data-query-arrow class="accent-stroke"/>
      <g class="query-handle" data-handle role="button" tabindex="0" aria-label="Move query vector; use arrow keys"><circle class="query-hit" r="15"/><circle class="query-point accent-fill" r="4"/><text x="8" y="-12">q</text></g>
      </svg></div>
      ${mode === "qkv" ? `<div class="vector-panel"><p class="plot-title">Mix values</p><svg class="plot" data-output-plot viewBox="0 0 220 220" role="img" aria-label="Value vectors and their weighted output">${axes}${values.map((value, i) => fixedArrow(value, `v${i + 1}`, i, "value")).join("")}<path data-output-arrow class="accent-stroke"/><text data-output-label>out</text></svg></div>` : ""}</div>
      <p class="hint">Drag the tip of q, or focus it and use the arrow keys.</p>
      ${mode === "qkv" ? `<div class="weights">${labels.map((label, i) => `<span>${escapeHTML(label)}<b data-weight="${i}"></b></span>`).join("")}</div>` : ""}
      <div class="equation" data-result role="status" aria-live="polite"></div>
      <details ${this.hasAttribute("compact") ? "hidden" : ""}><summary>Details</summary><p data-coordinates></p>
      ${mode === "qkv" ? `<p>${latex("s_i=\\frac{q\\cdot k_i}{\\sqrt{2}},\\quad a_i=\\frac{e^{s_i}}{\\sum_j e^{s_j}},\\quad o=\\sum_i a_i v_i")}</p><p>The dot products set the weights. Those weights combine the value vectors. This two-dimensional example shows one query with all shown keys available.</p><div class="table-scroll"><table><thead><tr><th>Token</th><th>Key</th><th>Value</th><th>Score</th><th>Weight</th></tr></thead><tbody>${keys.map((key, i) => `<tr><td>${escapeHTML(labels[i])}</td><td>[${key}]</td><td>[${values[i]}]</td><td data-score="${i}"></td><td data-prob="${i}"></td></tr>`).join("")}</tbody></table></div>` : `<p>${latex("q\\cdot k=q_xk_x+q_yk_y")}</p><p>Direction and length both matter. Perpendicular vectors have a zero dot product; opposite directions can give a negative one.</p>`}
      <button data-reset>Reset query</button></details>`,
      mode === "qkv"
        ? "The query matches keys. The resulting weights mix values."
        : "A dot product is a sum of coordinate-wise products.",
    );
    const format = (n: number) => String(Number(n.toFixed(3)));
    const factor = (n: number) => (n < 0 ? `(${format(n)})` : format(n));
    const update = () => {
      const [x, y] = point(query);
      this.find("[data-query-arrow]").setAttribute("d", arrow(query));
      this.find("[data-handle]").setAttribute(
        "transform",
        `translate(${x} ${y})`,
      );
      this.find("[data-handle]").setAttribute(
        "aria-label",
        `Query [${format(query[0])}, ${format(query[1])}]. Move with arrow keys.`,
      );
      this.find("[data-coordinates]").textContent =
        `q = [${query.map(format).join(", ")}]${mode === "dot" ? `; k = [${keys[0].join(", ")}]` : ""}`;
      if (mode === "dot") {
        this.find("[data-result]").innerHTML = latex(
          `${factor(query[0])}\\cdot${factor(keys[0][0])}+${factor(query[1])}\\cdot${factor(keys[0][1])}=${format(dot(query, keys[0]))}`,
        );
      } else {
        const result = attention2(query, keys, values);
        this.find("[data-output-arrow]").setAttribute(
          "d",
          arrow(result.output),
        );
        const [ox, oy] = point(result.output);
        this.find("[data-output-label]").setAttribute(
          "x",
          String(Math.min(195, ox + 8)),
        );
        this.find("[data-output-label]").setAttribute("y", String(oy - 12));
        result.weights.forEach((weight, i) => {
          this.find(`[data-weight="${i}"]`).textContent =
            `${(weight * 100).toFixed(1)}%`;
          this.find(`[data-score="${i}"]`).textContent = format(
            result.scores[i],
          );
          this.find(`[data-prob="${i}"]`).textContent = weight.toFixed(4);
          this.find(`[data-value="${i}"] path`).setAttribute(
            "opacity",
            String(0.25 + 0.75 * weight),
          );
        });
        this.find("[data-result]").innerHTML = latex(
          `o=\\sum_i a_iv_i=(${result.output.map(format).join(",\\ ")})`,
        );
      }
    };
    const svg = this.find<SVGSVGElement>("[data-query-plot]");
    let pointer: number | null = null;
    const move = (event: PointerEvent) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      query = [
        Math.max(-extent, Math.min(extent, (local.x - 110) / unit)),
        Math.max(-extent, Math.min(extent, (110 - local.y) / unit)),
      ];
      update();
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
      if (event instanceof PointerEvent && pointer === event.pointerId)
        move(event);
    });
    const release = (event: Event) => {
      if (!(event instanceof PointerEvent) || pointer !== event.pointerId)
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
        } as Record<string, number[]>
      )[event.key];
      if (!delta) return;
      event.preventDefault();
      query = query.map((n, i) =>
        Math.max(
          -extent,
          Math.min(extent, n + delta[i] * (event.shiftKey ? 0.5 : 0.1)),
        ),
      ) as Vector2;
      update();
    });
    this.on("click", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-reset]")
      ) {
        query = [...initial];
        update();
      }
    });
    update();
  }
}
if (!customElements.get("vector-attention"))
  customElements.define("vector-attention", VectorAttention);
