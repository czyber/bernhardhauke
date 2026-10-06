import { LearningFigure } from "./LearningFigure";
import { TensorPixels } from "./TensorPixels";
import { embeddingExample } from "../lib/neural-examples";
import { escapeHTML, latex } from "../lib/tensor-math";
import { tensorDomain } from "../lib/tensor";

class TokenEmbeddings extends LearningFigure {
  protected setup() {
    const example = embeddingExample(
      this.json("vocabulary", ["the", "cat", "sat"]),
      this.json("ids", [0, 1, 2, 0]),
      this.json("embeddings", [
        [0.2, -0.5, 0.8, 0.1],
        [0.7, 0.1, -0.3, 0.6],
        [-0.4, 0.6, 0.2, 0.5],
      ]),
    );
    const { vocabulary, ids, embeddings, width } = example;
    this.mount(
      `<style>:host([bare]) .readout{display:none}</style><div class="scroll"><div class="tokens" role="group" aria-label="Tokens and vocabulary IDs">${ids.map((id, position) => `<button class="token" data-id="${id}" aria-label="Token ${position}: ${escapeHTML(vocabulary[id])}, ID ${id}">${escapeHTML(vocabulary[id])}<small>ID ${id}</small></button>`).join("")}</div></div>
      <p class="hint">Inspect a token to find its embedding row.</p>
      <div class="scroll"><div class="lookup"><tensor-pixels data-table term label="$E$"></tensor-pixels><span class="arrow" aria-hidden="true">→</span><tensor-pixels data-vector term label="$e$"></tensor-pixels></div></div>
      <p class="readout" role="status" aria-live="polite"></p>
      <details ${this.hasAttribute("compact") ? "hidden" : ""}><summary>Details</summary><p>${latex("e_t = E[\\operatorname{id}(t), :]")}</p><p>The ID selects a row. Repeated IDs return the same vector. These example values stand in for learned parameters.</p><label><input type="checkbox" data-values ${this.hasAttribute("show-values") ? "checked" : ""}>Show values</label></details>`,
      "A token ID selects a vector from the embedding table.",
    );
    const table = this.find<TensorPixels>("[data-table]");
    const vector = this.find<TensorPixels>("[data-vector]");
    if (this.hasAttribute("bare")) {
      table.setAttribute("bare", "");
      vector.setAttribute("bare", "");
    }
    const flat = embeddings.flat();
    const palette = flat.some((n) => n < 0) ? "diverging" : "sequential";
    const domain = tensorDomain({ values: flat, palette });
    table.configure(
      {
        name: "E",
        shape: [vocabulary.length, width],
        values: flat,
        axes: ["token", "feature"],
        labels: [vocabulary, null],
        palette,
        caption: "Vocabulary",
      },
      domain,
    );
    let current = -1;
    const valuesVisible = () =>
      this.find<HTMLInputElement>("[data-values]").checked;
    const clear = () => {
      table.linkCells([]);
      vector.linkCells([]);
      this.root
        .querySelectorAll<HTMLElement>("[data-id]")
        .forEach((token) => (token.dataset.active = "false"));
    };
    const show = (id: number, highlight: boolean) => {
      if (id !== current) {
        current = id;
        vector.configure(
          {
            name: "e",
            shape: [width],
            values: embeddings[id],
            axes: ["feature"],
            palette,
            caption: `ID ${id}`,
          },
          domain,
        );
        vector.setValuesVisible(valuesVisible());
      }
      this.find(".readout").textContent =
        `${vocabulary[id]} → ID ${id} → E[${id}, :]`;
      this.root
        .querySelectorAll<HTMLElement>("[data-id]")
        .forEach(
          (token) =>
            (token.dataset.active = String(
              highlight && Number(token.dataset.id) === id,
            )),
        );
      table.linkCells(
        highlight ? Array.from({ length: width }, (_, col) => [id, col]) : [],
      );
      vector.linkCells(
        highlight ? Array.from({ length: width }, (_, col) => [col]) : [],
      );
    };
    show(ids[0], false);
    table.setValuesVisible(valuesVisible());
    const inspect = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const token = event.target.closest<HTMLElement>("[data-id]");
      if (token) show(Number(token.dataset.id), true);
    };
    this.on("pointerover", inspect);
    this.on("focusin", inspect);
    this.on("click", inspect);
    this.on(
      "pointerleave",
      (event) => {
        if (event.target instanceof Element && event.target.matches(".tokens"))
          clear();
      },
      true,
    );
    this.on("focusout", (event) => {
      if (event.target instanceof Element && event.target.closest("[data-id]"))
        clear();
    });
    this.on("tensor-inspect", (event) => {
      if (event instanceof CustomEvent && event.target === table)
        show(event.detail.indices[0], true);
    });
    this.on("tensor-leave", clear);
    this.on("change", () => {
      table.setValuesVisible(valuesVisible());
      vector.setValuesVisible(valuesVisible());
    });
    this.on("keydown", (event) => {
      if (
        !(event instanceof KeyboardEvent) ||
        !(event.target instanceof Element)
      )
        return;
      const tokens = [
        ...this.root.querySelectorAll<HTMLButtonElement>("[data-id]"),
      ];
      const index = tokens.indexOf(event.target as HTMLButtonElement);
      if (index < 0 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      tokens[
        (index + (event.key === "ArrowLeft" ? tokens.length - 1 : 1)) %
          tokens.length
      ].focus();
    });
  }
}
if (!customElements.get("token-embeddings"))
  customElements.define("token-embeddings", TokenEmbeddings);
