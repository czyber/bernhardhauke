import { LearningFigure } from "./LearningFigure";
import { gptStages, modelStages } from "../lib/neural-examples";
import { escapeHTML, mathText, latex } from "../lib/tensor-math";

class ModelDiagram extends LearningFigure {
  protected setup() {
    const custom = this.hasAttribute("stages");
    const expanded = this.hasAttribute("expanded") || this.hasAttribute("bare");
    const activation = this.getAttribute("activation") ?? "gelu";
    if (!["gelu", "relu"].includes(activation))
      throw new Error("Choose gelu or relu activation.");
    const activationLabel = activation === "relu" ? "ReLU" : "GELU";
    const stages = custom
      ? modelStages(this.json("stages", null))
      : gptStages(Number(this.getAttribute("layers") ?? 2)).map((stage) =>
          activation === "relu" && stage.label === "Vocabulary"
            ? {
                ...stage,
                note: "A learned projection converts each token vector to V vocabulary scores (logits). Sampling uses the last position.",
              }
            : stage,
        );
    stages.forEach((stage) => {
      mathText(stage.label);
      mathText(stage.shape);
      mathText(stage.note);
      if (
        stage.href &&
        !["https:", "http:"].includes(
          new URL(stage.href, document.baseURI).protocol,
        )
      )
        throw new Error(
          "Stage links must point to an article, code note, or HTTP(S) page.",
        );
    });
    this.mount(
      `<style>:host([bare]) .stage-note,:host([bare]) .expanded-block>.plot-title{display:none}</style><div class="scroll"><div class="stages" role="group" aria-label="Model stages">${stages.map((stage, i) => `${i ? '<span class="stage-arrow" aria-hidden="true">→</span>' : ""}<button class="stage" data-stage="${i}" aria-label="${escapeHTML(stage.label)}">${mathText(stage.label)}<span class="shape">${mathText(stage.shape)}</span></button>`).join("")}</div></div>
      <p class="hint">Inspect a stage to see what changes.</p>
      <p class="stage-note" data-note role="status" aria-live="polite">${custom ? mathText(stages[0].note) : "The shape follows the data from token IDs to vocabulary scores. Every block keeps one vector of C features for each token."}</p>
      ${
        custom
          ? ""
          : `${expanded ? '<div class="expanded-block"><p class="plot-title">Inside one transformer block</p>' : "<details><summary>Inside one transformer block</summary>"}
      <svg class="block-diagram" viewBox="0 0 540 290" role="img" aria-label="Pre-normalized transformer block: input plus attention of normalized input, then another residual addition around an MLP of normalized input.">
      <path class="axis" d="M270 18 V270 M270 30 H92 V132 H256 M270 150 H92 V247 H256"/>
      <path class="axis" d="M265 42 L270 48 L275 42 M265 80 L270 86 L275 80 M265 157 L270 163 L275 157 M265 195 L270 201 L275 195 M249 127 L256 132 L249 137 M249 242 L256 247 L249 252"/>
      <rect class="block-node" x="180" y="48" width="180" height="30" rx="5"/><text x="270" y="67" text-anchor="middle">LayerNorm</text>
      <rect class="block-node" x="180" y="86" width="180" height="30" rx="5"/><text x="270" y="105" text-anchor="middle">Causal attention</text>
      <circle class="block-node" cx="270" cy="132" r="14"/><text x="270" y="136" text-anchor="middle">+</text>
      <rect class="block-node" x="180" y="163" width="180" height="30" rx="5"/><text x="270" y="182" text-anchor="middle">LayerNorm</text>
      <rect class="block-node" x="180" y="201" width="180" height="30" rx="5"/><text x="270" y="220" text-anchor="middle">Linear → ${activationLabel} → Linear</text>
      <circle class="block-node" cx="270" cy="247" r="14"/><text x="270" y="251" text-anchor="middle">+</text>
      <text x="270" y="12" text-anchor="middle">x</text><text x="270" y="286" text-anchor="middle">output</text><text x="80" y="89" text-anchor="end">residual</text><text x="80" y="206" text-anchor="end">residual</text>
      </svg><p class="equation">${latex("h=x+\\operatorname{Attention}(\\operatorname{LN}(x))")}</p><p class="equation">${latex("y=h+\\operatorname{MLP}(\\operatorname{LN}(h))")}</p>${expanded ? "</div>" : "</details>"}`
      }`,
      "Follow the same token vectors through a GPT-2-style model.",
    );
    const clear = () =>
      this.root
        .querySelectorAll<HTMLElement>("[data-stage]")
        .forEach((node) => (node.dataset.active = "false"));
    const inspect = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const node = event.target.closest<HTMLElement>("[data-stage]");
      if (!node) return;
      const stage = stages[Number(node.dataset.stage)];
      clear();
      node.dataset.active = "true";
      this.find("[data-note]").innerHTML =
        `${mathText(stage.note)}${stage.href ? ` <a href="${escapeHTML(stage.href)}">See this in the article →</a>` : ""}`;
    };
    this.on("pointerover", inspect);
    this.on("focusin", inspect);
    this.on("click", inspect);
    this.on(
      "pointerleave",
      (event) => {
        if (event.target instanceof Element && event.target.matches(".stages"))
          clear();
      },
      true,
    );
    this.on("focusout", clear);
    this.on("keydown", (event) => {
      if (
        !(event instanceof KeyboardEvent) ||
        !(event.target instanceof Element)
      )
        return;
      const nodes = [
        ...this.root.querySelectorAll<HTMLButtonElement>("[data-stage]"),
      ];
      const index = nodes.indexOf(event.target as HTMLButtonElement);
      if (index < 0 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      nodes[
        (index + (event.key === "ArrowLeft" ? nodes.length - 1 : 1)) %
          nodes.length
      ].focus();
    });
  }
}
if (!customElements.get("model-diagram"))
  customElements.define("model-diagram", ModelDiagram);
