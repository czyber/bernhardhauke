/** @jsxImportSource @motion-canvas/2d/lib */

import {Player, Stage, bootstrap} from "@motion-canvas/core/lib/app";
import {ValueDispatcher} from "@motion-canvas/core/lib/events";
import {all, waitFor} from "@motion-canvas/core/lib/flow";
import {MetaFile} from "@motion-canvas/core/lib/meta";
import {Vector2} from "@motion-canvas/core/lib/types";
import {easeInOutCubic, easeOutCubic} from "@motion-canvas/core/lib/tweening";
import {createRef} from "@motion-canvas/core/lib/utils";
import {Code, Rect, makeScene2D} from "@motion-canvas/2d/lib";

const WIDTH = 1280;
const HEIGHT = 360;

const sentenceCode = "The GPU stores the model weights";
const tokenCode = '["The", "ĠGPU", "Ġstores", "Ġthe", "Ġmodel", "Ġweights"]';
const idCode = "[791, 47852, 20109, 279, 1646, 10259]";
const codeScale = 4.2;

function getPalette() {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark";

  if (isDark) {
    return {
      bg: "#000000",
      surface: "#1a1a1a",
      surfaceSoft: "#1f1f1f",
      text: "#ededed",
      muted: "#a0a0a0",
      border: "rgba(255, 255, 255, 0.24)",
      borderStrong: "rgba(255, 255, 255, 0.38)",
      accent: "#b36a48",
      accentSoft: "rgba(179, 106, 72, 0.16)",
      accentLine: "rgba(179, 106, 72, 0.52)",
      shadow: "rgba(0, 0, 0, 0.62)",
    };
  }

  return {
    bg: "#ffffff",
    surface: "#ffffff",
    surfaceSoft: "#fafafa",
    text: "#171717",
    muted: "#4d4d4d",
    border: "rgba(0, 0, 0, 0.14)",
    borderStrong: "rgba(0, 0, 0, 0.24)",
    accent: "#a65f3f",
    accentSoft: "rgba(166, 95, 63, 0.14)",
    accentLine: "rgba(166, 95, 63, 0.46)",
    shadow: "rgba(0, 0, 0, 0.12)",
  };
}

const scene = makeScene2D(function* (view) {
  const palette = getPalette();
  const code = createRef<Code>();

  view.add([
    <Rect width={WIDTH} height={HEIGHT} fill={palette.bg} />,
    <Code
      ref={code}
      code={sentenceCode}
      fill={palette.text}
      fontFamily={
        "Geist Mono, SFMono-Regular, ui-monospace, Consolas, Liberation Mono, monospace"
      }
      fontSize={62}
      fontWeight={620}
      lineHeight={78}
      textAlign={"center"}
      scale={codeScale}
    />,
  ]);

  yield* waitFor(0.55);

  yield* all(
    code().code(tokenCode, 0.78, easeInOutCubic),
    code().fontSize(42, 0.28, easeInOutCubic),
    code().fill(palette.accent, 0.18, easeOutCubic),
    code().scale(codeScale * 1.02, 0.18, easeOutCubic),
  );
  yield* all(
    code().fill(palette.text, 0.24, easeOutCubic),
    code().scale(codeScale, 0.24, easeOutCubic),
  );

  yield* waitFor(0.55);

  yield* all(
    code().code(idCode, 0.72, easeInOutCubic),
    code().fontSize(48, 0.28, easeInOutCubic),
    code().fill(palette.accent, 0.18, easeOutCubic),
    code().scale(codeScale * 1.02, 0.18, easeOutCubic),
  );
  yield* all(
    code().fill(palette.text, 0.24, easeOutCubic),
    code().scale(codeScale, 0.24, easeOutCubic),
  );

  yield* waitFor(120);
});

const sceneDescription = {
  ...scene,
  name: "text-to-tokens",
  onReplaced: new ValueDispatcher(scene),
};

const project = bootstrap(
  "llm-serving-text-to-tokens",
  {
    core: "3.17.2",
    two: "3.17.2",
    ui: null,
    vitePlugin: null,
  },
  [],
  {
    name: "llm-serving-text-to-tokens",
    scenes: [sceneDescription as never],
  },
  new MetaFile("llm-serving-text-to-tokens-project"),
  new MetaFile("llm-serving-text-to-tokens-settings"),
);

class TextToTokensAnimation extends HTMLElement {
  private stage?: Stage;
  private player?: Player;
  private intersectionObserver?: IntersectionObserver;
  private readonly mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  connectedCallback() {
    if (this.shadowRoot) {
      this.player?.activate();
      return;
    }

    const shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          overflow: hidden;
          border: 1px solid var(--border, rgba(0, 0, 0, 0.14));
          border-radius: 2px;
          background: var(--surface, #ffffff);
          box-shadow: 0 18px 48px var(--edge-dark, rgba(0, 0, 0, 0.12));
        }

        canvas {
          display: block;
          width: 100%;
          height: auto;
        }

        button {
          position: absolute;
          right: 12px;
          bottom: 12px;
          border: 1px solid var(--border, rgba(0, 0, 0, 0.14));
          border-radius: 2px;
          padding: 7px 10px;
          background: color-mix(in srgb, var(--surface, #ffffff) 92%, transparent);
          color: var(--text, #171717);
          font: 600 11px/1.2 SFMono-Regular, ui-monospace, Consolas, Liberation Mono, monospace;
          cursor: pointer;
        }

        .frame {
          position: relative;
        }
      </style>
      <div class="frame"></div>
    `;

    const frame = shadowRoot.querySelector(".frame");
    if (!frame) return;

    const settings = {
      ...project.meta.getFullPreviewSettings(),
      fps: 60,
      range: [0, Infinity] as [number, number],
      resolutionScale: Math.min(window.devicePixelRatio || 1, 2),
      size: new Vector2(WIDTH, HEIGHT),
    };

    this.stage = new Stage();
    this.stage.configure(settings);
    this.player = new Player(project, settings);
    this.player.toggleLoop(false);

    this.stage.finalBuffer.setAttribute(
      "aria-label",
      "A sentence morphing into a token list and then into token ID numbers.",
    );
    frame.append(this.stage.finalBuffer);

    const replayButton = document.createElement("button");
    replayButton.type = "button";
    replayButton.textContent = "replay";
    replayButton.addEventListener("click", () => {
      this.player?.requestReset();
      this.player?.togglePlayback(true);
    });
    frame.append(replayButton);

    this.player.onRender.subscribe(async () => {
      if (!this.player || !this.stage) return;
      await this.stage.render(
        this.player.playback.currentScene,
        this.player.playback.previousScene,
      );
    });

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (!this.player) return;
        this.player.togglePlayback(entry.isIntersecting && !this.mediaQuery.matches);
      },
      {threshold: 0.35},
    );
    this.intersectionObserver.observe(this);

    this.player.togglePlayback(!this.mediaQuery.matches);
  }

  disconnectedCallback() {
    this.intersectionObserver?.disconnect();
    this.player?.togglePlayback(false);
    this.player?.deactivate();
  }
}

if (!customElements.get("text-to-tokens-animation")) {
  customElements.define("text-to-tokens-animation", TextToTokensAnimation);
}
