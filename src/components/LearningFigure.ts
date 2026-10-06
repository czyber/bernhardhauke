import {
  escapeHTML,
  loadTensorMath,
  mathStyles,
  mathText,
} from "../lib/tensor-math";
import styles from "../styles/learning-figures.css?inline";

export abstract class LearningFigure extends HTMLElement {
  protected root = this.attachShadow({ mode: "open" });
  protected controller?: AbortController;
  async connectedCallback() {
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    this.root.innerHTML = "<slot></slot>";
    try {
      await loadTensorMath();
      if (controller.signal.aborted || !this.isConnected) return;
      this.setup();
    } catch (error) {
      this.root.innerHTML = `<style>${styles}</style><slot></slot><p class="error">Figure unavailable: ${escapeHTML(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }
  disconnectedCallback() {
    this.controller?.abort();
  }
  protected abstract setup(): void;
  protected json(name: string, fallback: unknown): unknown {
    return this.hasAttribute(name)
      ? JSON.parse(this.getAttribute(name)!)
      : fallback;
  }
  protected mount(body: string, caption: string) {
    this.root.innerHTML = `<style>${styles}${mathStyles()}</style><figure>${body}<figcaption>${mathText(this.getAttribute("caption") ?? caption)}</figcaption></figure>`;
  }
  protected on(
    type: string,
    listener: (event: Event) => void,
    capture = false,
  ) {
    this.root.addEventListener(type, listener, {
      signal: this.controller!.signal,
      capture,
    });
  }
  protected find<T extends Element = HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!;
  }
}
