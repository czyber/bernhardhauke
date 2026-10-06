import { TensorPixels } from "./TensorPixels";
import {
  evaluateTensors,
  tensorIndices,
  tensorPython,
} from "../lib/tensor-operations";
import type {
  EvaluatedTensor,
  TensorDefinition,
  TensorOperation,
  TensorReference,
} from "../lib/tensor-operations";
import { formatTensorValue, tensorDomain, tensorOffset } from "../lib/tensor";
import {
  escapeHTML,
  latex,
  loadTensorMath,
  mathStyles,
  mathText,
} from "../lib/tensor-math";
import styles from "../styles/tensor-equation.css?inline";

const numberList = (element: Element, name: string) => {
  if (!element.hasAttribute(name)) return undefined;
  const text = element.getAttribute(name)!.trim();
  if (!text) return [];
  return text.split(",").map((part) => (part.trim() ? Number(part) : NaN));
};
const numberAttribute = (element: Element, name: string) =>
  element.hasAttribute(name) ? Number(element.getAttribute(name)) : undefined;

class TensorEquation extends HTMLElement {
  private root = this.attachShadow({ mode: "open" });
  private controller?: AbortController;
  private tensors = new Map<string, EvaluatedTensor>();
  private elements = new Map<string, TensorPixels>();

  async connectedCallback() {
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    try {
      await loadTensorMath();
      if (controller.signal.aborted || !this.isConnected) return;
      this.elements.clear();
      const definitions = [...this.children]
        .filter((child) => child instanceof TensorPixels)
        .map((element) => {
          const name = element.getAttribute("name") ?? "";
          if (this.elements.has(name))
            throw new Error(`Repeated tensor name: ${name}`);
          this.elements.set(name, element);
          return {
            name,
            values: element.hasAttribute("values")
              ? JSON.parse(element.getAttribute("values")!)
              : undefined,
            op:
              (element.getAttribute("op") as TensorOperation | null) ??
              undefined,
            inputs: element.hasAttribute("inputs")
              ? element
                  .getAttribute("inputs")!
                  .split(",")
                  .map((s) => s.trim())
              : undefined,
            shape: numberList(element, "shape"),
            dims: numberList(element, "dims"),
            sizes: numberList(element, "sizes"),
            axis: numberAttribute(element, "axis"),
            part: numberAttribute(element, "part"),
            axes: element.hasAttribute("axes")
              ? element
                  .getAttribute("axes")!
                  .split(",")
                  .map((s) => s.trim())
              : undefined,
            labels: element.hasAttribute("labels")
              ? JSON.parse(element.getAttribute("labels")!)
              : undefined,
            caption: element.getAttribute("caption") ?? "",
          } satisfies TensorDefinition;
        });
      this.tensors = evaluateTensors(definitions);
      const formula =
        this.getAttribute("formula") ??
        [...this.tensors.keys()].map((name) => `{{${name}}}`).join(" = ");
      const used = new Set<string>();
      const markup = formula
        .split(/(\{\{[A-Za-z][A-Za-z0-9_]*\}\})/g)
        .map((part) => {
          if (!part.startsWith("{{"))
            return part.trim()
              ? `<span class="operator">${latex(part)}</span>`
              : "";
          const name = part.slice(2, -2);
          if (!this.tensors.has(name))
            throw new Error(`Formula refers to unknown tensor: ${name}`);
          if (used.has(name))
            throw new Error(
              `Place ${name} once per equation, or give a second term its own name.`,
            );
          used.add(name);
          return `<slot name="term-${name}"></slot>`;
        })
        .join("");
      if (!used.size)
        throw new Error("Put a tensor in the formula using {{its_name}}.");
      const values = [...this.tensors.values()].flatMap(
        (tensor) => tensor.values,
      );
      const palette = values.some((value) => value < 0)
        ? "diverging"
        : "sequential";
      const domain = tensorDomain({ values, palette });
      const caption = this.getAttribute("caption");
      this.root.innerHTML = `<style>${styles}${mathStyles()}</style><figure aria-label="${escapeHTML(this.getAttribute("aria-label") ?? "Tensor equation")}">
        <div class="equation-scroll" tabindex="0" role="group" aria-label="Tensor equation; scroll horizontally on narrow screens"><div class="equation">${markup}</div></div>
        <div class="tools"><span>Inspect a square to follow its calculation.</span><label><input type="checkbox" data-values ${this.hasAttribute("show-values") ? "checked" : ""}/>Show values</label></div>
        <div class="working" role="status" aria-live="polite" aria-atomic="true"><p class="address">Hover, tap, or use the arrow keys.</p><div class="calculation">Matching entries highlight together. Move away to clear.</div></div>
        ${caption ? `<figcaption>${mathText(caption)}</figcaption>` : ""}
        <details><summary>Equivalent PyTorch</summary><button type="button" data-copy>Copy code</button><pre><code>${escapeHTML(tensorPython(this.tensors))}</code></pre></details>
      </figure>`;
      for (const [name, tensor] of this.tensors) {
        const element = this.elements.get(name)!;
        element.setAttribute("term", "");
        element.setAttribute("slot", `term-${name}`);
        element.configure({ ...tensor, palette }, domain);
        element.setValuesVisible(this.hasAttribute("show-values"));
      }
      const options = { signal: controller.signal };
      this.addEventListener(
        "tensor-inspect",
        (event) => {
          if (
            !(event instanceof CustomEvent) ||
            !(event.target instanceof TensorPixels)
          )
            return;
          this.inspect(
            event.target.getAttribute("name")!,
            event.detail.indices,
          );
        },
        options,
      );
      this.addEventListener(
        "tensor-leave",
        () => this.elements.forEach((element) => element.linkCells([])),
        options,
      );
      this.addEventListener(
        "tensor-slice",
        (event) => {
          if (
            event instanceof CustomEvent &&
            event.target instanceof TensorPixels
          )
            this.synchronizeAdditionSlices(
              event.target.getAttribute("name")!,
              event.detail.prefix,
            );
        },
        options,
      );
      this.root.addEventListener(
        "change",
        (event) => {
          if (event.target instanceof HTMLInputElement)
            this.elements.forEach((element) =>
              element.setValuesVisible(
                (event.target as HTMLInputElement).checked,
              ),
            );
        },
        options,
      );
      this.root
        .querySelector<HTMLButtonElement>("[data-copy]")!
        .addEventListener(
          "click",
          async (event) => {
            const button = event.currentTarget as HTMLButtonElement;
            try {
              await navigator.clipboard.writeText(tensorPython(this.tensors));
              button.textContent = "Copied";
            } catch {
              button.textContent = "Select the code to copy";
            }
          },
          options,
        );
    } catch (error) {
      this.root.innerHTML = `<style>${styles}</style><slot></slot><p class="error">Tensor equation unavailable: ${escapeHTML(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }

  disconnectedCallback() {
    this.controller?.abort();
  }

  private synchronizeAdditionSlices(name: string, prefix: number[]) {
    const pending = new Map([[name, prefix]]);
    // Equal broadcast axes describe the same slice. A singleton input stays
    // at zero and never forces the other operands back to their first batch.
    for (const [sourceName, sourcePrefix] of pending) {
      const source = this.tensors.get(sourceName)!;
      for (const [resultName, result] of this.tensors) {
        if (result.definition.op !== "add") continue;
        const members = [resultName, ...result.definition.inputs!];
        if (!members.includes(sourceName)) continue;
        for (const targetName of members) {
          if (pending.has(targetName)) continue;
          const target = this.tensors.get(targetName)!;
          const element = this.elements.get(targetName)!;
          const nextPrefix = element.getSlice();
          let shared = false;
          sourcePrefix.forEach((index, axis) => {
            const targetAxis = axis + target.shape.length - source.shape.length;
            if (targetAxis < 0 || targetAxis >= nextPrefix.length) return;
            if (source.shape[axis] === target.shape[targetAxis]) {
              nextPrefix[targetAxis] = index;
              shared = true;
            }
          });
          if (shared) {
            if (nextPrefix.join() !== element.getSlice().join())
              element.selectSlice(nextPrefix);
            pending.set(targetName, nextPrefix);
          }
        }
      }
    }
    this.elements.forEach((element) => element.linkCells([]));
  }

  private inspect(name: string, indices: number[]) {
    const tensor = this.tensors.get(name)!;
    const index = tensorOffset(tensor.shape, indices);
    const linked = new Map<string, Set<number>>();
    const add = (ref: TensorReference) => {
      const indices = linked.get(ref.name) ?? new Set<number>();
      if (indices.has(ref.index)) return;
      indices.add(ref.index);
      linked.set(ref.name, indices);
      this.tensors.get(ref.name)!.sources(ref.index).forEach(add);
    };
    add({ name, index });
    // Follow one-to-one rearrangements in both directions. Arithmetic is traced
    // from its result so a broadcast input doesn't light up an entire batch.
    for (const [nextName, next] of this.tensors) {
      if (
        !next.definition.op ||
        next.definition.op === "add" ||
        next.definition.op === "matmul" ||
        next.definition.op === "kron"
      )
        continue;
      next.values.forEach((_, i) => {
        if (next.sources(i).some((ref) => linked.get(ref.name)?.has(ref.index)))
          add({ name: nextName, index: i });
      });
    }
    for (const [key, element] of this.elements) {
      const current = this.tensors.get(key)!;
      element.linkCells(
        [...(linked.get(key) ?? [])].map((index) =>
          tensorIndices(current.shape, index),
        ),
      );
    }
    const format = (value: number) =>
      formatTensorValue(value).replace(/e([+-]?\d+)/, "\\times 10^{$1}");
    const address = (ref: TensorReference) =>
      `${ref.name}[${tensorIndices(this.tensors.get(ref.name)!.shape, ref.index).join(", ")}]`;
    const refs = tensor.sources(index);
    const context = indices
      .map((i, axis) =>
        tensor.labels?.[axis]?.[i]
          ? `${tensor.axes[axis]}: ${tensor.labels[axis]![i]}`
          : "",
      )
      .filter(Boolean)
      .join(" · ");
    this.root.querySelector(".address")!.innerHTML =
      `<code>${escapeHTML(address({ name, index }))} = ${formatTensorValue(tensor.values[index])}</code>${context ? `<span>${mathText(context)}</span>` : ""}`;
    const calculation = this.root.querySelector(".calculation")!;
    if (tensor.definition.op === "add") {
      const terms = refs.map((ref) => {
        const value = this.tensors.get(ref.name)!.values[ref.index];
        return value < 0 ? `(${format(value)})` : format(value);
      });
      calculation.innerHTML = latex(
        `${terms.join(" + ")} = ${format(tensor.values[index])}`,
      );
    } else if (
      tensor.definition.op === "matmul" ||
      tensor.definition.op === "kron"
    ) {
      const products: string[] = [];
      for (let i = 0; i < refs.length; i += 2) {
        const left = this.tensors.get(refs[i].name)!.values[refs[i].index];
        const right = this.tensors.get(refs[i + 1].name)!.values[
          refs[i + 1].index
        ];
        products.push(
          `${left < 0 ? `(${format(left)})` : format(left)} \\cdot ${right < 0 ? `(${format(right)})` : format(right)}`,
        );
      }
      calculation.innerHTML = latex(
        `${products.join(" + ")} = ${format(tensor.values[index])}`,
      );
    } else if (refs.length) {
      calculation.innerHTML = `<code>${escapeHTML(address(refs[0]))} → ${escapeHTML(address({ name, index }))}</code><span>Same value, ${formatTensorValue(tensor.values[index])}.</span>`;
    } else {
      const matches = [...linked].flatMap(([key, offsets]) =>
        key === name
          ? []
          : [...offsets].map((index) => address({ name: key, index })),
      );
      calculation.textContent = matches.length
        ? `Same entry in ${matches.join(" · ")}`
        : "Inspect a result to see the contributing input cells.";
    }
  }
}

if (!customElements.get("tensor-equation"))
  customElements.define("tensor-equation", TensorEquation);
