const template = document.createElement("template");

template.innerHTML = `
  <style>
    :host {
      display: block;
      max-width: 720px;
      margin: 40px 0;
      color: var(--text, #171717);
      font-family: var(
        --font-mono,
        "SFMono-Regular",
        Consolas,
        monospace
      );
    }

    * {
      box-sizing: border-box;
    }

    .meaning {
      border-block: 1px solid var(--border, rgba(0, 0, 0, 0.12));
      padding-block: 18px 16px;
    }

    .topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 30px;
    }

    .layer-label {
      color: var(--muted, #4d4d4d);
      font-size: 11px;
      line-height: 1.4;
    }

    .controls {
      display: flex;
      flex: 0 0 auto;
      gap: 6px;
    }

    button {
      border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
      border-radius: 2px;
      padding: 5px 8px;
      background: transparent;
      color: var(--muted, #4d4d4d);
      font: inherit;
      font-size: 10px;
      line-height: 1;
      cursor: pointer;
    }

    button:hover:not(:disabled),
    button:focus-visible {
      border-color: var(--accent, #a65f3f);
      color: var(--text, #171717);
    }

    button:focus-visible {
      outline: 2px solid var(--accent, #a65f3f);
      outline-offset: 2px;
    }

    button:disabled {
      cursor: default;
      opacity: 0.45;
    }

    .timeline {
      position: relative;
      height: 24px;
      margin: 12px 0 5px;
    }

    .timeline-line,
    .timeline-progress {
      position: absolute;
      top: 6px;
      left: 0;
      height: 1px;
    }

    .timeline-line {
      right: 0;
      background: var(--border, rgba(0, 0, 0, 0.12));
    }

    .timeline-progress {
      width: 0;
      background: var(--accent, #a65f3f);
      transition: width 480ms cubic-bezier(0.2, 0, 0, 1);
    }

    .ticks {
      position: relative;
      display: flex;
      justify-content: space-between;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tick {
      position: relative;
      flex: 0 0 1px;
      width: 1px;
      height: 24px;
    }

    .tick::after {
      position: absolute;
      top: 2px;
      left: 0;
      width: 1px;
      height: 9px;
      background: var(--border-strong, rgba(0, 0, 0, 0.22));
      content: "";
      transition:
        background 180ms ease,
        height 180ms ease,
        top 180ms ease,
        width 180ms ease,
        transform 180ms ease;
    }

    .tick:nth-child(3n + 1)::after {
      top: 0;
      height: 13px;
    }

    .tick:first-child::before,
    .tick:last-child::before {
      position: absolute;
      top: 15px;
      color: var(--subtle, #7d7d7d);
      font-size: 8px;
      line-height: 1;
    }

    .tick:first-child::before {
      left: 0;
      content: "E";
    }

    .tick:last-child::before {
      right: 0;
      content: "L12";
    }

    .tick.past::after {
      background: var(--accent-line, rgba(166, 95, 63, 0.46));
    }

    .tick.active::after {
      top: 0;
      width: 5px;
      height: 13px;
      background: var(--accent, #a65f3f);
      box-shadow: 0 0 0 2px var(--surface, #fff);
      transform: translateX(-2px);
    }

    .tracks {
      margin-top: 8px;
    }

    .track {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(170px, 220px);
      align-items: center;
      gap: 20px;
      padding: 16px 0;
    }

    .track + .track {
      border-top: 1px solid var(--border, rgba(0, 0, 0, 0.12));
    }

    .token-space {
      position: relative;
      min-width: 0;
      padding-top: 23px;
    }

    .connections {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 30px;
      overflow: visible;
      pointer-events: none;
    }

    .connection {
      fill: none;
      stroke: var(--subtle, #7d7d7d);
      stroke-linecap: square;
      stroke-linejoin: miter;
      stroke-width: 1;
      opacity: 0.22;
    }

    .connection.relevant {
      stroke: var(--accent, #a65f3f);
      stroke-width: 1.5;
      opacity: 0.34;
    }

    .track.looking .connection {
      animation: connection-pulse 470ms ease-out both;
    }

    .track.looking .connection.relevant {
      animation-name: relevant-pulse;
    }

    .tokens {
      position: relative;
      z-index: 1;
      display: flex;
      gap: 5px;
      min-width: 0;
    }

    .token {
      min-width: 0;
      border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
      border-radius: 2px;
      padding: 4px 6px;
      background: var(--surface, #fff);
      color: var(--subtle, #7d7d7d);
      font-size: 10px;
      line-height: 1;
      white-space: nowrap;
      transition:
        border-color 160ms ease,
        background 160ms ease,
        color 160ms ease,
        transform 160ms ease;
    }

    .token.bank {
      border-color: var(--accent-line, rgba(166, 95, 63, 0.46));
      background: var(--accent-soft, rgba(166, 95, 63, 0.14));
      color: var(--accent, #a65f3f);
    }

    .track.looking .token.bank {
      transform: translateY(-2px);
    }

    .track.looking .token.relevant {
      border-color: var(--accent, #a65f3f);
      color: var(--accent, #a65f3f);
    }

    .vector {
      min-width: 0;
    }

    .vector-label {
      display: block;
      margin-bottom: 4px;
      color: var(--subtle, #7d7d7d);
      font-size: 9px;
      line-height: 1;
    }

    .fingerprint {
      display: block;
      width: 100%;
      height: 54px;
    }

    .baseline {
      stroke: var(--border, rgba(0, 0, 0, 0.12));
      stroke-width: 1;
    }

    .bar {
      fill: var(--accent, #a65f3f);
      opacity: 0.78;
      transition:
        y 520ms cubic-bezier(0.2, 0, 0, 1),
        height 520ms cubic-bezier(0.2, 0, 0, 1),
        opacity 160ms ease;
    }

    .track.looking .bar {
      opacity: 0.48;
    }

    .no-transition .bar,
    .no-transition .timeline-progress {
      transition: none;
    }

    .bottomline {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      border-top: 1px solid var(--border, rgba(0, 0, 0, 0.12));
      padding-top: 12px;
    }

    .status {
      color: var(--muted, #4d4d4d);
      font-size: 11px;
      line-height: 1.4;
    }

    .note {
      flex: 0 0 auto;
      color: var(--subtle, #7d7d7d);
      font-size: 9px;
      line-height: 1.4;
    }

    @keyframes connection-pulse {
      0% {
        opacity: 0.22;
        stroke-dasharray: 2 4;
        stroke-dashoffset: 7;
      }
      42% {
        opacity: 0.78;
      }
      100% {
        opacity: 0.22;
        stroke-dasharray: 2 4;
        stroke-dashoffset: 0;
      }
    }

    @keyframes relevant-pulse {
      0% {
        opacity: 0.34;
        stroke-dasharray: 3 3;
        stroke-dashoffset: 8;
      }
      42% {
        opacity: 0.95;
      }
      100% {
        opacity: 0.34;
        stroke-dasharray: 3 3;
        stroke-dashoffset: 0;
      }
    }

    @media (max-width: 520px) {
      :host {
        margin-block: 32px;
      }

      .track {
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
        padding-block: 14px;
      }

      .token {
        padding-inline: 5px;
        font-size: 9px;
      }

      .fingerprint {
        height: 48px;
      }

      .bottomline {
        align-items: flex-start;
        flex-direction: column;
        gap: 3px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }
  </style>

  <section
    class="meaning"
    aria-label="How the token bank changes across transformer layers"
  >
    <div class="topline">
      <span class="layer-label" aria-live="polite">
        Embedding · identical vectors
      </span>
      <div class="controls">
        <button class="pause" type="button">Pause</button>
        <button class="replay" type="button">Replay</button>
      </div>
    </div>

    <div class="timeline" aria-hidden="true">
      <span class="timeline-line"></span>
      <span class="timeline-progress"></span>
      <ol class="ticks">
        <li class="tick" data-layer="0"></li>
        <li class="tick" data-layer="1"></li>
        <li class="tick" data-layer="2"></li>
        <li class="tick" data-layer="3"></li>
        <li class="tick" data-layer="4"></li>
        <li class="tick" data-layer="5"></li>
        <li class="tick" data-layer="6"></li>
        <li class="tick" data-layer="7"></li>
        <li class="tick" data-layer="8"></li>
        <li class="tick" data-layer="9"></li>
        <li class="tick" data-layer="10"></li>
        <li class="tick" data-layer="11"></li>
        <li class="tick" data-layer="12"></li>
      </ol>
    </div>

    <div class="tracks">
      <div class="track" data-track="a">
        <div class="token-space">
          <svg class="connections" aria-hidden="true"></svg>
          <div class="tokens" aria-label="the river bank was muddy">
            <span class="token">the</span>
            <span class="token relevant">river</span>
            <span class="token bank">bank</span>
            <span class="token">was</span>
            <span class="token">muddy</span>
          </div>
        </div>
        <div class="vector">
          <span class="vector-label">“bank” vector</span>
          <svg
            class="fingerprint"
            data-fingerprint="a"
            viewBox="0 0 216 54"
            role="img"
            aria-label="Illustrative vector for bank in the river sentence"
            preserveAspectRatio="none"
          >
            <line class="baseline" x1="5" x2="211" y1="49" y2="49"></line>
            <g class="bars"></g>
          </svg>
        </div>
      </div>

      <div class="track" data-track="b">
        <div class="token-space">
          <svg class="connections" aria-hidden="true"></svg>
          <div class="tokens" aria-label="the investment bank was busy">
            <span class="token">the</span>
            <span class="token relevant">investment</span>
            <span class="token bank">bank</span>
            <span class="token">was</span>
            <span class="token">busy</span>
          </div>
        </div>
        <div class="vector">
          <span class="vector-label">“bank” vector</span>
          <svg
            class="fingerprint"
            data-fingerprint="b"
            viewBox="0 0 216 54"
            role="img"
            aria-label="Illustrative vector for bank in the investment sentence"
            preserveAspectRatio="none"
          >
            <line class="baseline" x1="5" x2="211" y1="49" y2="49"></line>
            <g class="bars"></g>
          </svg>
        </div>
      </div>
    </div>

    <div class="bottomline">
      <span class="status" aria-live="polite">
        Same token. Same starting vector.
      </span>
      <span class="note">Illustrative, not activation values.</span>
    </div>
  </section>
`;

class MeaningAcrossLayers extends HTMLElement {
  private readonly root: ShadowRoot;
  private readonly totalLayers = 12;
  private readonly base = [22, 36, 17, 42, 27, 32, 19, 40, 24, 37, 16, 29];
  private readonly targetA = [41, 20, 36, 46, 16, 43, 31, 19, 40, 25, 35, 45];
  private readonly targetB = [15, 45, 24, 19, 43, 22, 47, 35, 17, 48, 28, 20];
  private readonly timers: number[] = [];
  private currentLayer = 0;
  private playing = false;
  private resizeObserver?: ResizeObserver;
  private reducedMotion = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    if (this.root.childElementCount > 0) return;

    this.root.append(template.content.cloneNode(true));
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    this.root.querySelectorAll<SVGSVGElement>(".fingerprint").forEach((svg) => {
      this.buildFingerprint(svg);
    });

    this.getElement<HTMLButtonElement>(".pause").addEventListener("click", () =>
      this.togglePause(),
    );
    this.getElement<HTMLButtonElement>(".replay").addEventListener(
      "click",
      () => this.replay(),
    );

    this.resizeObserver = new ResizeObserver(() => this.drawConnections());
    this.resizeObserver.observe(this);

    if (this.reducedMotion) {
      this.renderLayer(this.totalLayers, false);
      this.getElement<HTMLButtonElement>(".pause").disabled = true;
    } else {
      this.renderLayer(0, false);
      this.start(650);
    }

    window.requestAnimationFrame(() => this.drawConnections());
  }

  disconnectedCallback() {
    this.stop(false);
    this.resizeObserver?.disconnect();
  }

  private getElement<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error("Missing MeaningAcrossLayers element: " + selector);
    }
    return element;
  }

  private buildFingerprint(svg: SVGSVGElement) {
    const bars = svg.querySelector<SVGGElement>(".bars");
    if (!bars) return;

    this.base.forEach((height, index) => {
      const bar = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      bar.setAttribute("class", "bar");
      bar.setAttribute("x", String(8 + index * 17));
      bar.setAttribute("width", "9");
      bar.setAttribute("rx", "1");
      bar.setAttribute("y", String(49 - height));
      bar.setAttribute("height", String(height));
      bars.appendChild(bar);
    });
  }

  private heightsFor(target: number[], layer: number) {
    const progress = layer / this.totalLayers;
    const eased = progress * progress * (3 - 2 * progress);

    return this.base.map((height, index) => {
      const curve =
        Math.sin(progress * Math.PI) *
        ((index % 4) - 1.5) *
        (target[index] > height ? 0.55 : -0.55);
      return height + (target[index] - height) * eased + curve;
    });
  }

  private renderLayer(layer: number, animate: boolean) {
    this.currentLayer = Math.max(0, Math.min(this.totalLayers, layer));
    const shell = this.getElement<HTMLElement>(".meaning");

    if (!animate) shell.classList.add("no-transition");

    (["a", "b"] as const).forEach((track) => {
      const target = track === "a" ? this.targetA : this.targetB;
      const heights = this.heightsFor(target, this.currentLayer);
      this.root
        .querySelectorAll<SVGRectElement>(
          '[data-fingerprint="' + track + '"] .bar',
        )
        .forEach((bar, index) => {
          const height = heights[index];
          bar.setAttribute("y", String(49 - height));
          bar.setAttribute("height", String(height));
        });
    });

    this.root.querySelectorAll<HTMLElement>(".tick").forEach((tick, index) => {
      tick.classList.toggle("past", index < this.currentLayer);
      tick.classList.toggle("active", index === this.currentLayer);
    });

    this.getElement<HTMLElement>(".timeline-progress").style.width =
      (this.currentLayer / this.totalLayers) * 100 + "%";

    const layerLabel = this.getElement<HTMLElement>(".layer-label");
    const status = this.getElement<HTMLElement>(".status");

    if (this.currentLayer === 0) {
      layerLabel.textContent = "Embedding · identical vectors";
      status.textContent = "Same token. Same starting vector.";
    } else if (this.currentLayer === this.totalLayers) {
      layerLabel.textContent = "Layer 12 · context-specific vectors";
      status.textContent = "Same start. Different meaning.";
    } else {
      layerLabel.textContent =
        "Layer " + this.currentLayer + " / " + this.totalLayers;
      status.textContent = "“bank” is absorbing context.";
    }

    if (!animate) {
      shell.getBoundingClientRect();
      shell.classList.remove("no-transition");
    }
  }

  private start(delay = 0) {
    this.clearTimers();
    this.playing = true;
    const pause = this.getElement<HTMLButtonElement>(".pause");
    pause.disabled = false;
    pause.textContent = "Pause";
    this.timers.push(window.setTimeout(() => this.scheduleNext(), delay));
  }

  private stop(updateButton = true) {
    this.playing = false;
    this.clearTimers();
    this.root.querySelectorAll(".track").forEach((track) => {
      track.classList.remove("looking");
    });
    if (updateButton) {
      this.getElement<HTMLButtonElement>(".pause").textContent = "Resume";
    }
  }

  private clearTimers() {
    while (this.timers.length > 0) {
      const timer = this.timers.pop();
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }

  private togglePause() {
    if (this.playing) {
      this.stop();
    } else if (this.currentLayer < this.totalLayers) {
      this.start();
    }
  }

  private replay() {
    this.stop(false);
    this.renderLayer(0, false);

    if (this.reducedMotion) {
      this.getElement<HTMLButtonElement>(".pause").disabled = true;
      this.timers.push(
        window.setTimeout(() => {
          this.renderLayer(this.totalLayers, false);
        }, 700),
      );
    } else {
      this.start(500);
    }
  }

  private scheduleNext() {
    if (!this.playing) return;
    if (this.currentLayer >= this.totalLayers) {
      this.finish();
      return;
    }

    this.pulseConnections();
    this.timers.push(
      window.setTimeout(() => {
        if (this.playing) this.renderLayer(this.currentLayer + 1, true);
      }, 320),
    );
    this.timers.push(window.setTimeout(() => this.scheduleNext(), 1080));
  }

  private finish() {
    this.stop(false);
    const pause = this.getElement<HTMLButtonElement>(".pause");
    pause.textContent = "Pause";
    pause.disabled = true;
  }

  private pulseConnections() {
    this.root.querySelectorAll<HTMLElement>(".track").forEach((track) => {
      track.classList.remove("looking");
      track.getBoundingClientRect();
      track.classList.add("looking");
    });

    this.timers.push(
      window.setTimeout(() => {
        this.root.querySelectorAll(".track").forEach((track) => {
          track.classList.remove("looking");
        });
      }, 480),
    );
  }

  private drawConnections() {
    this.root.querySelectorAll<HTMLElement>(".track").forEach((track) => {
      const svg = track.querySelector<SVGSVGElement>(".connections");
      const bank = track.querySelector<HTMLElement>(".bank");
      const tokens = Array.from(track.querySelectorAll<HTMLElement>(".token"));
      if (!svg || !bank) return;

      const bankIndex = tokens.indexOf(bank);
      const svgRect = svg.getBoundingClientRect();
      const bankRect = bank.getBoundingClientRect();
      const bankX = bankRect.left - svgRect.left + bankRect.width / 2;
      const bankY = bankRect.top - svgRect.top + 2;

      svg.replaceChildren();
      svg.setAttribute("viewBox", "0 0 " + svgRect.width + " 30");

      // The faint links are every earlier token. River or investment is only
      // emphasized as the useful contextual cue.
      tokens.slice(0, bankIndex).forEach((token, index) => {
        const tokenRect = token.getBoundingClientRect();
        const tokenX = tokenRect.left - svgRect.left + tokenRect.width / 2;
        const tokenY = tokenRect.top - svgRect.top + 2;
        const bankPortX =
          bankX + (index - (bankIndex - 1) / 2) * Math.min(4, 12 / bankIndex);
        const laneY = 2 + index * Math.min(5, 16 / bankIndex);
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );

        path.setAttribute(
          "class",
          token.classList.contains("relevant")
            ? "connection relevant"
            : "connection",
        );
        path.setAttribute(
          "d",
          "M " +
            bankPortX +
            " " +
            bankY +
            " V " +
            laneY +
            " H " +
            tokenX +
            " V " +
            " " +
            tokenY,
        );
        svg.appendChild(path);
      });
    });
  }
}

if (!customElements.get("meaning-across-layers")) {
  customElements.define("meaning-across-layers", MeaningAcrossLayers);
}
