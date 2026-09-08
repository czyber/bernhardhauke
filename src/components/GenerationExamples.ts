import evidence from "../data/generation-examples.json";

// The recorded outputs are shared by the loop and sampling demonstrations.
// Keep this presentation independent of model execution and external services.
const styles = `
  :host {
    display: block;
    margin-block: 28px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    text-align: left;
    hyphens: none;
  }
  * { box-sizing: border-box; }
  .example { border-block: 1px solid var(--border); padding-block: 12px; }
  .toolbar, .controls { display: flex; align-items: center; gap: 12px; }
  .toolbar { justify-content: space-between; flex-wrap: wrap; }
  .label, .note, .count { color: var(--muted); }
  .count { font-variant-numeric: tabular-nums; white-space: nowrap; }
  button {
    appearance: none;
    border: 0;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    padding: 9px 2px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
    min-height: 40px;
  }
  button:hover:not(:disabled) { color: var(--text); }
  button:disabled { opacity: 0.4; cursor: default; }
  button:focus-visible, input:focus-visible, [role="tabpanel"]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  button[aria-selected="true"] {
    border-bottom-color: var(--accent);
    color: var(--text);
  }
  .tabs { display: flex; flex-wrap: wrap; gap: 20px; }
  .timeline { display: flex; align-items: center; gap: 18px; margin-top: 8px; }
  input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 28px;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }
  pre {
    margin: 18px 0;
    padding: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
    font-size: 13px;
    line-height: 1.85;
    tab-size: 2;
  }
  .note { margin: 12px 0 0; font-size: 11px; line-height: 1.6; }
  .output-stack { display: grid; }
  .output-stack > pre { grid-area: 1 / 1; }
  .output-stack > pre[hidden] {
    display: block;
    visibility: hidden;
    pointer-events: none;
  }
  @media (max-width: 520px) {
    .tabs { gap: 18px; }
    .toolbar { gap: 0 12px; }
    .timeline { gap: 12px; }
    pre { font-size: 12px; }
  }
  @media print {
    .controls, .timeline { display: none; }
    .tabs { border-bottom: 1px solid var(--border); }
  }
`;

class TokenLoop extends HTMLElement {
  private timer?: number;
  private cleanup?: () => void;

  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${styles}</style>
      <section class="example" aria-label="Recorded greedy generation">
        <div class="toolbar">
          <span class="label">Greedy decoding</span>
          <div class="controls">
            <button type="button" class="play">Replay</button>
            <button type="button" class="next">Next token</button>
          </div>
        </div>
        <div class="timeline">
          <input type="range" min="0" max="${evidence.greedyTokens.length}" aria-label="Number of generated tokens">
          <span class="count" aria-live="off"></span>
        </div>
        <div class="output-stack">
          <pre class="loop-size" hidden aria-hidden="true"></pre>
          <pre class="loop-output" aria-label="Generated text"></pre>
        </div>
        <p class="note">Recorded GPT-2 output · one token appended at each step.</p>
      </section>`;
    const play = root.querySelector<HTMLButtonElement>(".play")!;
    const next = root.querySelector<HTMLButtonElement>(".next")!;
    const range = root.querySelector<HTMLInputElement>("input")!;
    const output = root.querySelector<HTMLPreElement>(".loop-output")!;
    root.querySelector<HTMLPreElement>(".loop-size")!.textContent =
      evidence.prompt + evidence.greedyTokens.join("");
    const count = root.querySelector<HTMLElement>(".count")!;
    const total = evidence.greedyTokens.length;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let step = total;

    const stop = () => {
      window.clearInterval(this.timer);
      this.timer = undefined;
      play.textContent = motion.matches
        ? "Reset"
        : step === total
          ? "Replay"
          : "Play";
    };
    const draw = () => {
      range.value = String(step);
      count.textContent = `${step} / ${total} tokens`;
      output.textContent =
        evidence.prompt + evidence.greedyTokens.slice(0, step).join("");
      next.disabled = step === total;
    };
    range.addEventListener("input", () => {
      step = Number(range.value);
      stop();
      draw();
    });
    next.addEventListener("click", () => {
      step = Math.min(total, step + 1);
      stop();
      draw();
    });
    play.addEventListener("click", () => {
      if (this.timer !== undefined) return stop();
      if (step === total || motion.matches) step = 0;
      draw();
      if (motion.matches) return stop();
      play.textContent = "Pause";
      this.timer = window.setInterval(() => {
        step += 1;
        draw();
        if (step === total) stop();
      }, 180);
    });
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    motion.addEventListener("change", stop);
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanup = () => {
      stop();
      motion.removeEventListener("change", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    stop();
    draw();
  }

  disconnectedCallback() {
    this.cleanup?.();
  }
}

let comparisonId = 0;

class SamplingComparison extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const isSeeds = this.getAttribute("mode") === "seeds";
    const runs = isSeeds ? evidence.seeds : evidence.temperatures;
    const id = `sampling-${++comparisonId}`;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${styles}</style>
      <section class="example" aria-label="${isSeeds ? "Same settings, different seeds" : "Temperature sampling comparison"}">
        <div class="tabs" role="tablist" aria-label="${isSeeds ? "Sampling seed" : "Sampling temperature"}"></div>
        <div role="tabpanel" tabindex="0" id="${id}-panel">
          <div class="output-stack"></div>
          <p class="note" aria-live="polite"></p>
        </div>
      </section>`;
    const tablist = root.querySelector<HTMLElement>(".tabs")!;
    const panel = root.querySelector<HTMLElement>("[role=tabpanel]")!;
    const stack = root.querySelector<HTMLElement>(".output-stack")!;
    const note = root.querySelector<HTMLElement>(".note")!;

    // Invisible outputs reserve the tallest output's height, so switching a tab
    // does not shift the paragraph the reader is about to read.
    const outputs = runs.map((run) => {
      const pre = document.createElement("pre");
      pre.textContent = run.text;
      stack.append(pre);
      return pre;
    });
    const tabs = runs.map((run, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `${id}-tab-${index}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", panel.id);
      button.textContent = run.label;
      button.addEventListener("click", () => select(index));
      button.addEventListener("keydown", (event) => {
        let target: number;
        if (event.key === "ArrowRight") target = (index + 1) % runs.length;
        else if (event.key === "ArrowLeft")
          target = (index + runs.length - 1) % runs.length;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = runs.length - 1;
        else return;
        event.preventDefault();
        select(target);
        tabs[target].focus();
      });
      tablist.append(button);
      return button;
    });
    const select = (index: number) => {
      tabs.forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        outputs[i].hidden = i !== index;
        outputs[i].setAttribute("aria-hidden", String(i !== index));
      });
      panel.setAttribute("aria-labelledby", tabs[index].id);
      const run = runs[index];
      note.textContent = isSeeds
        ? `T = 1 · top-p = 0.9 · ${run.tokens} new tokens · ${"eos" in run && run.eos ? "stopped on EOS (50256)" : "reached the token limit"}`
        : "Seed 42 · 50 new tokens · no top-k or top-p filter";
    };
    select(isSeeds ? 0 : 1);
  }
}

if (!customElements.get("token-loop"))
  customElements.define("token-loop", TokenLoop);
if (!customElements.get("sampling-comparison"))
  customElements.define("sampling-comparison", SamplingComparison);
