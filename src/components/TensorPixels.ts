import { tensorExample } from "../data/tensor-examples";
import {
  formatTensorValue,
  tensorDomain,
  tensorFromNested,
  tensorSlice,
  tensorLabels,
} from "../lib/tensor";
import type { PixelTensor, TensorPalette } from "../lib/tensor";
import styles from "../styles/tensor-pixels.css?inline";
import {
  loadTensorMath,
  mathReady,
  mathStyles,
  mathText,
} from "../lib/tensor-math";

const VOXEL = { pitch: 6, edge: 5, depthX: 0.42, depthY: 0.32, scale: 4 };
let nextTensorId = 0;

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

export class TensorPixels extends HTMLElement {
  private root = this.attachShadow({ mode: "open" });
  private clipId = `tensor-voxel-${nextTensorId++}`;
  private tensor!: PixelTensor;
  private sliceIndices: number[] = [];
  private row = 0;
  private column = 0;
  private domain: [number, number] = [0, 1];
  private view: "slices" | "3d" = "slices";
  private controller?: AbortController;
  private provided?: PixelTensor;
  private providedDomain?: [number, number];

  configure(tensor: PixelTensor, domain: [number, number]) {
    this.provided = tensor;
    this.providedDomain = domain;
    this.connectedCallback();
  }

  setValuesVisible(visible: boolean) {
    const toggle = this.root.querySelector<HTMLInputElement>("[data-values]");
    if (toggle) {
      toggle.checked = visible;
      this.showNumbers();
    }
  }

  getSlice() {
    return [...this.sliceIndices];
  }

  linkCells(indices: number[][]) {
    if (indices.length) {
      const prefix = indices[0].slice(
        0,
        Math.max(0, this.tensor.shape.length - 2),
      );
      if (prefix.join() !== this.sliceIndices.join()) this.selectSlice(prefix);
    }
    const selected = new Set(indices.map((index) => index.join(",")));
    this.root
      .querySelectorAll<SVGGraphicsElement>(".pixel, .depth-voxel")
      .forEach((pixel) => {
        const index = this.indices(
          Number(pixel.dataset.row),
          Number(pixel.dataset.column),
        );
        if (pixel.dataset.depth !== undefined)
          index[0] = Number(pixel.dataset.depth);
        const linked = selected.has(index.join(","));
        pixel.dataset.linked = String(linked);
        pixel.dataset.dimmed = String(indices.length > 0 && !linked);
      });
  }

  connectedCallback() {
    // The equation resolves declared operations before initializing its terms.
    if (this.parentElement?.localName === "tensor-equation" && !this.provided)
      return;
    if (
      !mathReady() &&
      [...this.attributes].some((attr) => attr.value.includes("$"))
    ) {
      this.root.innerHTML = "<slot></slot>";
      void loadTensorMath()
        .then(() => {
          if (this.isConnected) this.connectedCallback();
        })
        .catch(() => {
          if (this.isConnected)
            this.root.innerHTML = `<style>${styles}</style><slot></slot><p class="error">Tensor figure unavailable: math could not load.</p>`;
        });
      return;
    }
    this.controller?.abort();
    this.controller = new AbortController();
    try {
      const preset = this.getAttribute("preset");
      if (this.provided) {
        this.tensor = { ...this.provided };
      } else if (preset) {
        this.tensor = tensorExample(preset);
      } else {
        const parsed = tensorFromNested(
          JSON.parse(this.getAttribute("values") ?? "null"),
        );
        this.tensor = {
          ...parsed,
          name: "tensor",
          axes: parsed.shape.map((_, i) => `axis ${i}`),
          palette: parsed.values.some((n) => n < 0)
            ? "diverging"
            : "sequential",
          caption: "",
        };
      }
      for (const attr of ["name", "caption"] as const) {
        if (this.hasAttribute(attr))
          this.tensor[attr] = this.getAttribute(attr)!;
      }
      if (this.hasAttribute("axes"))
        this.tensor.axes = this.getAttribute("axes")!
          .split(",")
          .map((s) => s.trim());
      if (
        this.tensor.axes.length !== this.tensor.shape.length ||
        this.tensor.axes.some((a) => !a)
      ) {
        throw new Error("Provide one non-empty axis label per dimension.");
      }
      if (this.hasAttribute("labels"))
        this.tensor.labels = tensorLabels(
          JSON.parse(this.getAttribute("labels")!),
          this.tensor.shape,
        );
      const palette = this.getAttribute("palette") ?? this.tensor.palette;
      if (!["binary", "sequential", "diverging"].includes(palette))
        throw new Error("Choose binary, sequential, or diverging colors.");
      this.tensor.palette = palette as TensorPalette;
      if (
        palette === "binary" &&
        this.tensor.values.some((n) => n !== 0 && n !== 1)
      )
        throw new Error("Binary figures accept only 0 and 1.");
      this.domain = this.providedDomain ?? tensorDomain(this.tensor);
      // Check every label now, including labels in currently hidden slices.
      [
        this.tensor.caption,
        this.getAttribute("label") ?? "",
        ...this.tensor.axes,
        ...(this.tensor.labels ?? []).flatMap((names) => names ?? []),
      ].forEach(mathText);
      this.sliceIndices = Array(Math.max(0, this.tensor.shape.length - 2)).fill(
        0,
      );
      this.row = this.column = 0;
      this.view =
        this.tensor.shape.length === 3 && this.getAttribute("view") === "3d"
          ? "3d"
          : "slices";
      this.render();
      this.bind();
    } catch (error) {
      this.root.innerHTML = `<style>${styles}</style><slot></slot><p class="error">Tensor figure unavailable: ${escape(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }

  disconnectedCallback() {
    this.controller?.abort();
  }

  private color(value: number) {
    if (this.tensor.palette === "binary")
      return value === 1 ? "var(--px-active)" : "var(--px-inactive)";
    const [low, high] = this.domain;
    const negative = this.tensor.palette === "diverging" && value < 0;
    const intensity =
      this.tensor.palette === "diverging"
        ? Math.abs(value) / high
        : (value - low) / (high - low);
    return `color-mix(in srgb, var(${negative ? "--px-negative" : "--px-active"}) ${Math.round(intensity * 100)}%, var(--px-inactive))`;
  }

  private indices(row: number, column: number) {
    return [
      ...this.sliceIndices,
      ...[[], [column], [row, column]][Math.min(this.tensor.shape.length, 2)],
    ];
  }

  private address(row: number, column: number) {
    return `${this.tensor.name}[${this.indices(row, column).join(", ")}]`;
  }

  private sliceName(prefix = this.sliceIndices) {
    return `${this.tensor.name}[${[...prefix.map(String), ...Array(Math.min(2, this.tensor.shape.length)).fill(":")].join(", ")}]`;
  }

  private pixels(prefix: number[], interactive: boolean) {
    const { rows, columns, values } = tensorSlice(this.tensor, prefix);
    const inset =
      interactive &&
      !this.hasAttribute("compact") &&
      !this.hasAttribute("term") &&
      !this.hasGridLabels()
        ? 4
        : 0;
    let content = "";
    for (let row = 0; row < rows; row++) {
      let cells = "";
      for (let col = 0; col < columns; col++) {
        const value = values[row * columns + col];
        const x = inset + col * 6 + 0.5;
        const y = inset + row * 6 + 0.5;
        const selected = row === this.row && col === this.column;
        const attr = interactive
          ? `class="pixel" role="gridcell" data-row="${row}" data-column="${col}" tabindex="${selected ? 0 : -1}" aria-rowindex="${row + 1}" aria-colindex="${col + 1}" aria-label="${escape(this.address(row, col))} = ${formatTensorValue(value)}"`
          : "";
        cells += `<rect ${attr} x="${x}" y="${y}" width="5" height="5" rx="1" fill="${this.color(value)}"/>`;
        if (interactive) {
          const strength =
            this.tensor.palette === "diverging"
              ? Math.abs(value) / this.domain[1]
              : (value - this.domain[0]) / (this.domain[1] - this.domain[0]);
          const textColor = strength > 0.6 ? "#1d1d1c" : "#f2eee7";
          const short = Number.isInteger(value)
            ? String(value)
            : value.toFixed(1);
          cells += `<text class="number" aria-hidden="true" x="${x + 2.5}" y="${y + 2.5}" fill="${textColor}" style="display:none">${short.length <= 4 ? short : "·"}</text>`;
        }
      }
      content += interactive
        ? `<g role="row" aria-rowindex="${row + 1}">${cells}</g>`
        : cells;
    }
    if (inset) {
      const step = Math.max(1, Math.ceil(columns / 16));
      for (let col = 0; col < columns; col += step)
        content += `<text class="tick" aria-hidden="true" x="${inset + col * 6 + 3}" y="2">${col}</text>`;
      for (let row = 0; row < rows; row += Math.max(1, Math.ceil(rows / 16)))
        content += `<text class="tick" aria-hidden="true" x="1" y="${inset + row * 6 + 3.7}">${row}</text>`;
    }
    const accessibility = interactive
      ? `class="grid" role="grid" aria-label="${escape(this.sliceName())}; use arrow keys to inspect values" aria-rowcount="${rows}" aria-colcount="${columns}"`
      : 'aria-hidden="true"';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columns * 6 + inset} ${rows * 6 + inset}" ${accessibility}>${content}</svg>`;
  }

  private hasGridLabels() {
    return Boolean(this.tensor.labels?.slice(-2).some((names) => names));
  }

  private gridMarkup() {
    const svg = this.pixels(this.sliceIndices, true);
    if (!this.hasGridLabels()) return svg;
    const { rows, columns } = tensorSlice(this.tensor, this.sliceIndices);
    const columnNames = this.tensor.labels?.at(-1);
    const rowNames =
      this.tensor.shape.length > 1 ? this.tensor.labels?.at(-2) : null;
    const columnLength = Math.max(
      0,
      ...(columnNames ?? []).map(
        (name) => name.replace(/\\[a-zA-Z]+|[$_^{}]/g, "").length,
      ),
    );
    const rotated = columnLength > 3;
    return `<div class="context-grid" style="--columns:${columns};--rows:${rows}">
      <div class="column-names${rotated ? " rotated" : ""}" style="--label-height:${Math.min(64, columnLength * 5 + 10)}px">${Array.from({ length: columns }, (_, i) => `<span title="${escape(columnNames?.[i] ?? String(i))}">${mathText(columnNames?.[i] ?? String(i))}</span>`).join("")}</div>
      <div class="row-names">${Array.from({ length: rows }, (_, i) => `<span title="${escape(rowNames?.[i] ?? String(i))}">${mathText(rowNames?.[i] ?? String(i))}</span>`).join("")}</div>${svg}</div>`;
  }

  private cube() {
    const { shape, axes, values } = this.tensor;
    const [depth, rows, columns] = shape;
    const layer = this.sliceIndices[0];
    const { pitch, edge, depthX, depthY } = VOXEL;
    const width = (columns - 1) * pitch + edge;
    const height = (rows - 1) * pitch + edge;
    const extent = (depth - 1) * pitch + edge;
    const backX = extent * depthX;
    const backY = -extent * depthY;
    const ex = edge * depthX;
    const ey = edge * depthY;
    const points = [
      [0, 0],
      [ex, -ey],
      [edge + ex, -ey],
      [edge + ex, edge - ey],
      [edge, edge],
      [0, edge],
    ];
    // Round the shared silhouette once. Clipping all faces together keeps the
    // cube solid, with no seams or gaps where individually rounded faces meet.
    const outline =
      points
        .map((point, index) => {
          const previous = points[(index + points.length - 1) % points.length];
          const next = points[(index + 1) % points.length];
          const inset = (neighbor: number[]) => {
            const dx = neighbor[0] - point[0];
            const dy = neighbor[1] - point[1];
            const length = Math.hypot(dx, dy);
            const radius = Math.min(0.7, length / 2);
            return `${point[0] + (dx / length) * radius} ${point[1] + (dy / length) * radius}`;
          };
          return `${index === 0 ? "M" : "L"}${inset(previous)}Q${point[0]} ${point[1]} ${inset(next)}`;
        })
        .join(" ") + "Z";
    let voxels = "";
    // Paint from back to front, bottom to top, left to right. Every element is
    // one solid voxel: three joined faces all derive their color from one value.
    // Interior voxels are occluded; revealing a layer makes those voxels visible.
    for (let z = depth - 1; z >= layer; z--) {
      let layerRows = "";
      for (let row = rows - 1; row >= 0; row--) {
        let cells = "";
        for (let column = 0; column < columns; column++) {
          if (z !== layer && row !== 0 && column !== columns - 1) continue;
          const value = values[(z * rows + row) * columns + column];
          const x = column * pitch + z * pitch * depthX;
          const y = row * pitch - z * pitch * depthY;
          const selected = row === this.row && column === this.column;
          const address = `${this.tensor.name}[${z}, ${row}, ${column}]`;
          const interactive =
            z === layer
              ? `class="voxel pixel" role="gridcell" tabindex="${selected ? 0 : -1}" aria-rowindex="${row + 1}" aria-colindex="${column + 1}" aria-label="${escape(address)} = ${formatTensorValue(value)}"`
              : `class="voxel depth-voxel" data-depth="${z}" role="button" tabindex="0" aria-label="Reveal ${escape(address)} = ${formatTensorValue(value)}"`;
          const short = Number.isInteger(value)
            ? String(value)
            : value.toFixed(1);
          const strength =
            this.tensor.palette === "diverging"
              ? Math.abs(value) / this.domain[1]
              : (value - this.domain[0]) / (this.domain[1] - this.domain[0]);
          cells += `<g ${interactive} data-row="${row}" data-column="${column}" transform="translate(${x} ${y})" style="--voxel-color:${this.color(value)}">
            <title>${escape(address)} = ${formatTensorValue(value)}</title>
            <g clip-path="url(#${this.clipId})">
              <path class="voxel-top" d="M0 0L${ex} ${-ey}H${edge + ex}L${edge} 0Z"/>
              <path class="voxel-side" d="M${edge} 0L${edge + ex} ${-ey}V${edge - ey}L${edge} ${edge}Z"/>
              <path class="voxel-front" d="M0 0H${edge}V${edge}H0Z"/>
            </g>
            <path class="voxel-outline" d="${outline}"/>
            ${z === layer ? `<text class="number" aria-hidden="true" x="${edge / 2}" y="${edge / 2}" fill="${strength > 0.6 ? "#1d1d1c" : "#f2eee7"}" style="display:none">${short.length <= 4 ? short : "·"}</text>` : ""}
          </g>`;
        }
        layerRows +=
          z === layer
            ? `<g role="row" aria-rowindex="${row + 1}">${cells}</g>`
            : cells;
      }
      voxels +=
        z === layer
          ? `<g role="grid" aria-label="${escape(this.sliceName())}; use arrow keys to inspect voxels" aria-rowcount="${rows}" aria-colcount="${columns}">${layerRows}</g>`
          : layerRows;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" class="cube" viewBox="-12 ${backY - 12} ${width + backX + 28} ${height - backY + 26}" role="group" aria-label="${escape(this.tensor.name)} as solid voxels; ${escape(axes[0])} ${layer} is revealed">
      <defs><clipPath id="${this.clipId}" clipPathUnits="userSpaceOnUse"><path d="${outline}"/></clipPath></defs>
      ${voxels}
      <g class="cube-labels" aria-hidden="true">
        ${this.cubeAxisLabel(`${axes[2]} · ${columns}`, width / 2, height + 10)}
        ${this.cubeAxisLabel(`${axes[1]} · ${rows}`, -7, height / 2, true)}
      </g>
    </svg>`;
  }

  private cubeAxisLabel(label: string, x: number, y: number, vertical = false) {
    const transform = `translate(${x} ${y})${vertical ? " rotate(-90)" : ""}`;
    return label.includes("$")
      ? `<foreignObject transform="${transform}" x="-40" y="-4" width="80" height="10"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center">${mathText(label)}</div></foreignObject>`
      : `<text transform="${transform}">${escape(label)}</text>`;
  }

  private render() {
    const { shape, axes, name, caption } = this.tensor;
    const controls = this.sliceIndices
      .map(
        (value, axis) =>
          `<label class="axis-control">${mathText(axes[axis])}<select data-axis="${axis}" aria-label="${escape(axes[axis])} slice">${Array.from({ length: shape[axis] }, (_, i) => `<option value="${i}"${i === value ? " selected" : ""}>${escape(this.tensor.labels?.[axis]?.[i] ?? String(i))}</option>`).join("")}</select></label>`,
      )
      .join("");
    this.root.innerHTML = `<style>${styles}${mathStyles()}</style>
      <figure aria-label="${escape(name)} tensor">
        <div class="heading"><div class="signature"><span class="name">${mathText(this.getAttribute("label") ?? name)}</span><span class="shape">[${shape.join(", ")}]</span></div><span class="meta">${shape.length}D · ${this.tensor.values.length} ${this.tensor.values.length === 1 ? "value" : "values"}</span></div>
        <div class="tools">${shape.length === 3 ? '<div class="view-toggle" role="group" aria-label="Tensor view"><button type="button" data-view="slices">Slices</button><button type="button" data-view="3d">3D</button></div>' : ""}${controls}<label class="value-toggle"><input type="checkbox" data-values ${this.hasAttribute("show-values") ? "checked" : ""}/>Show values</label></div>
        <div class="scene"><div class="atlas" aria-label="Tensor slices"></div><div class="matrix">
          <p class="axis-top axis-label">${mathText(axes.at(-1) ?? "scalar")}${shape.length ? ` · ${shape.at(-1)}` : ""}</p>
          <div class="plot"><span class="axis-side axis-label">${shape.length > 1 ? `${mathText(axes.at(-2)!)} · ${shape.at(-2)}` : ""}</span><div class="grid-wrap"></div></div>
          <div class="legend">${this.legend()}</div>
        </div><div class="volume" hidden><div class="cube-wrap"></div><div class="legend">${this.legend()}</div></div></div>
        <div class="inspect"><p class="address" role="status" aria-live="polite" aria-atomic="true"></p><p class="row-info"></p></div>
        <p class="context"></p>
        <p class="hint">Hover or tap a square. Arrow keys move between values. Indices start at 0.</p>
        ${caption ? `<figcaption>${mathText(caption)}</figcaption>` : ""}
        <details class="data"><summary>Read this slice as a table</summary><div class="table-scroll"></div></details>
      </figure>`;
    this.renderSlice();
  }

  private legend() {
    if (this.tensor.palette === "binary")
      return `<span class="swatch" style="background:var(--px-inactive)"></span>0<span class="swatch" style="background:var(--px-active);margin-left:10px"></span>1`;
    const [low, high] = this.domain;
    const ramp = Array.from(
      { length: 9 },
      (_, i) =>
        `<span class="swatch" style="background:${this.color(low + ((high - low) * i) / 8)}"></span>`,
    ).join("");
    return `<span>${formatTensorValue(low)}</span><span class="ramp" aria-hidden="true">${ramp}</span><span>${formatTensorValue(high)}</span>`;
  }

  private renderSlice() {
    const { rows, columns, values } = tensorSlice(
      this.tensor,
      this.sliceIndices,
    );
    const cube = this.view === "3d";
    const matrix = this.root.querySelector<HTMLElement>(".matrix")!;
    const volume = this.root.querySelector<HTMLElement>(".volume")!;
    matrix.hidden = cube;
    volume.hidden = !cube;
    this.root.querySelector(".grid-wrap")!.innerHTML = cube
      ? ""
      : this.gridMarkup();
    this.root.querySelector(".cube-wrap")!.innerHTML = cube ? this.cube() : "";
    const rowLabelWidth = this.hasGridLabels()
      ? Math.min(
          80,
          Math.max(
            1,
            ...(this.tensor.labels?.at(-2) ?? []).map(
              (name) => name.replace(/\\[a-zA-Z]+|[$_^{}]/g, "").length,
            ),
          ) *
            7 +
            4,
        ) + 8
      : 0;
    this.root
      .querySelector<HTMLElement>(".grid-wrap")!
      .style.setProperty(
        "--row-label-width",
        `${Math.max(0, rowLabelWidth - 8)}px`,
      );
    const matrixWidth = this.hasAttribute("term")
      ? columns * 22 + rowLabelWidth
      : this.hasAttribute("compact")
        ? columns * 16 + rowLabelWidth
        : columns * 24 + (this.hasGridLabels() ? 24 : 40) + rowLabelWidth;
    matrix.style.setProperty("--matrix-width", `${matrixWidth}px`);
    if (cube)
      volume.style.setProperty(
        "--volume-width",
        `${((columns - 1) * VOXEL.pitch + VOXEL.edge + ((this.tensor.shape[0] - 1) * VOXEL.pitch + VOXEL.edge) * VOXEL.depthX + 28) * VOXEL.scale}px`,
      );
    this.style.setProperty(
      "--term-width",
      `${cube ? Math.min(260, ((columns - 1) * VOXEL.pitch + VOXEL.edge + ((this.tensor.shape[0] - 1) * VOXEL.pitch + VOXEL.edge) * VOXEL.depthX + 28) * VOXEL.scale) : Math.max(110, matrixWidth)}px`,
    );
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-view]")
      .forEach((button) => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.view === this.view),
        );
      });
    this.root.querySelector(".hint")!.textContent = cube
      ? "Each element is a solid cube. Click an exposed voxel to reveal its layer. Hover, tap, or use arrow keys to inspect the front layer."
      : "Hover or tap a square. Arrow keys move between values. Indices start at 0.";
    this.renderAtlas();
    this.showNumbers();
    this.inspect(this.row, this.column, false);
    this.root.querySelector(".table-scroll")!.innerHTML =
      `<table><caption>${escape(this.sliceName())} — values rounded to 4 decimal places</caption><thead><tr><th scope="col">${mathText(this.tensor.axes.at(-2) ?? "index")}</th>${Array.from({ length: columns }, (_, i) => `<th scope="col">${mathText(this.tensor.labels?.at(-1)?.[i] ?? String(i))}</th>`).join("")}</tr></thead><tbody>${Array.from(
        { length: rows },
        (_, row) =>
          `<tr><th scope="row">${mathText(this.tensor.shape.length > 1 ? (this.tensor.labels?.at(-2)?.[row] ?? String(row)) : String(row))}</th>${values
            .slice(row * columns, (row + 1) * columns)
            .map((n) => `<td>${formatTensorValue(n)}</td>`)
            .join("")}</tr>`,
      ).join("")}</tbody></table>`;
  }

  private renderAtlas() {
    const atlas = this.root.querySelector<HTMLElement>(".atlas")!;
    const leading = this.tensor.shape.slice(0, -2);
    const count = leading.reduce((a, b) => a * b, 1);
    atlas.hidden = this.view === "3d" || !leading.length || count > 12;
    // Explicit display also overrides the figure's grid rule when hidden.
    atlas.style.display = atlas.hidden ? "none" : "";
    if (atlas.hidden) return;
    atlas.style.setProperty(
      "--atlas-columns",
      String(Math.min(3, leading.at(-1)!)),
    );
    atlas.innerHTML = Array.from({ length: count }, (_, index) => {
      let remaining = index;
      const prefix = leading.map(() => 0);
      for (let axis = leading.length - 1; axis >= 0; axis--) {
        prefix[axis] = remaining % leading[axis];
        remaining = Math.floor(remaining / leading[axis]);
      }
      const label = prefix
        .map((value, axis) => `${this.tensor.axes[axis]} ${value}`)
        .join(", ");
      const short = prefix.length === 1 ? label : prefix.join(" · ");
      return `<button type="button" class="thumbnail" data-prefix="${prefix.join(",")}" aria-label="Show ${escape(label)}" aria-pressed="${prefix.join(",") === this.sliceIndices.join(",")}">${this.pixels(prefix, false)}<span>${escape(short)}</span></button>`;
    }).join("");
  }

  private showNumbers() {
    const visible =
      this.root.querySelector<HTMLInputElement>("[data-values]")!.checked;
    this.root.querySelectorAll<SVGTextElement>(".number").forEach((text) => {
      text.style.display = visible ? "" : "none";
    });
  }

  private inspect(row: number, column: number, highlight = true) {
    this.row = row;
    this.column = column;
    const { columns, values } = tensorSlice(this.tensor, this.sliceIndices);
    const value = values[row * columns + column];
    this.root
      .querySelectorAll<SVGGraphicsElement>(".pixel")
      .forEach((pixel) => {
        const r = Number(pixel.dataset.row);
        const c = Number(pixel.dataset.column);
        const selected = r === row && c === column;
        pixel.setAttribute("tabindex", selected ? "0" : "-1");
        pixel.dataset.selected = String(highlight && selected);
        pixel.dataset.dimmed = String(highlight && r !== row && c !== column);
      });
    this.root.querySelector(".address")!.innerHTML =
      `${escape(this.address(row, column))} <span class="muted">=</span> <span class="value">${formatTensorValue(value)}</span>`;
    this.root.querySelector(".context")!.innerHTML = this.indices(row, column)
      .map((index, axis) =>
        this.tensor.labels?.[axis]?.[index]
          ? `${mathText(this.tensor.axes[axis])}: ${mathText(this.tensor.labels[axis]![index])}`
          : "",
      )
      .filter(Boolean)
      .join(" · ");
    const info = this.root.querySelector(".row-info")!;
    if (this.tensor.palette === "binary") {
      info.textContent = `row ${row}: ${values.slice(row * columns, (row + 1) * columns).filter((n) => n === 1).length} of ${columns} active`;
    } else {
      const sum = values
        .slice(row * columns, (row + 1) * columns)
        .reduce((a, b) => a + b, 0);
      info.textContent = `row ${row} sum: ${formatTensorValue(sum)}`;
    }
    if (highlight)
      this.dispatchEvent(
        new CustomEvent("tensor-inspect", {
          bubbles: true,
          composed: true,
          detail: { indices: this.indices(row, column) },
        }),
      );
  }

  selectSlice(prefix: number[], notify = false) {
    this.sliceIndices = prefix;
    this.root
      .querySelectorAll<HTMLSelectElement>("[data-axis]")
      .forEach((select, axis) => {
        select.value = String(prefix[axis]);
      });
    this.renderSlice();
    if (notify)
      this.dispatchEvent(
        new CustomEvent("tensor-slice", {
          bubbles: true,
          composed: true,
          detail: { prefix },
        }),
      );
  }

  private clearHighlight() {
    this.root
      .querySelectorAll<SVGGraphicsElement>(".pixel")
      .forEach((pixel) => {
        pixel.dataset.selected = "false";
        pixel.dataset.dimmed = "false";
      });
    this.dispatchEvent(
      new CustomEvent("tensor-leave", { bubbles: true, composed: true }),
    );
  }

  private revealDepth(depth: number, row: number, column: number) {
    this.row = row;
    this.column = column;
    this.selectSlice([depth], true);
    this.root
      .querySelector<SVGGraphicsElement>('.pixel[tabindex="0"]')!
      .focus();
  }

  private bind() {
    const options = { signal: this.controller!.signal };
    this.root.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement) this.showNumbers();
        if (target instanceof HTMLSelectElement) {
          const prefix = [...this.sliceIndices];
          prefix[Number(target.dataset.axis)] = Number(target.value);
          this.selectSlice(prefix, true);
        }
      },
      options,
    );
    this.root.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) return;
        const view = event.target.closest<HTMLButtonElement>("[data-view]");
        if (view) {
          this.view = view.dataset.view as "slices" | "3d";
          this.renderSlice();
          return;
        }
        const depth = event.target.closest<SVGGElement>("[data-depth]");
        if (depth) {
          this.revealDepth(
            Number(depth.dataset.depth),
            Number(depth.dataset.row),
            Number(depth.dataset.column),
          );
          return;
        }
        const thumb = event.target.closest<HTMLButtonElement>("[data-prefix]");
        if (thumb) {
          const prefix = thumb.dataset.prefix!;
          this.selectSlice(prefix.split(",").map(Number), true);
          this.root
            .querySelector<HTMLButtonElement>(`[data-prefix="${prefix}"]`)!
            .focus();
        }
        const pixel = event.target.closest<SVGGraphicsElement>(".pixel");
        if (pixel)
          this.inspect(Number(pixel.dataset.row), Number(pixel.dataset.column));
      },
      options,
    );
    const inspectPixel = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const pixel = event.target.closest<SVGGraphicsElement>(".pixel");
      if (pixel)
        this.inspect(Number(pixel.dataset.row), Number(pixel.dataset.column));
    };
    this.root.addEventListener("pointerover", inspectPixel, options);
    this.root.addEventListener("focusin", inspectPixel, options);
    // Hover feedback ends at the graphic's edge, even after clicking a cell.
    // Keep the last address and keyboard position without pinning its highlight.
    this.root.addEventListener(
      "pointerleave",
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.matches(".grid, .cube")
        )
          this.clearHighlight();
      },
      { ...options, capture: true },
    );
    this.root.addEventListener(
      "focusout",
      (event) => {
        if (
          !(event instanceof FocusEvent) ||
          !(event.target instanceof Element)
        )
          return;
        const grid = event.target.closest(".grid, .cube");
        if (
          grid &&
          (!(event.relatedTarget instanceof Node) ||
            !grid.contains(event.relatedTarget))
        )
          this.clearHighlight();
      },
      options,
    );
    this.root.addEventListener(
      "keydown",
      (event) => {
        if (event instanceof KeyboardEvent && event.target instanceof Element) {
          const depth = event.target.closest<SVGGElement>("[data-depth]");
          if (depth && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            this.revealDepth(
              Number(depth.dataset.depth),
              Number(depth.dataset.row),
              Number(depth.dataset.column),
            );
            return;
          }
        }
        if (
          !(event instanceof KeyboardEvent) ||
          !(event.target instanceof SVGGraphicsElement) ||
          !event.target.classList.contains("pixel")
        )
          return;
        const { rows, columns } = tensorSlice(this.tensor, this.sliceIndices);
        let row = Number(event.target.dataset.row);
        let column = Number(event.target.dataset.column);
        switch (event.key) {
          case "ArrowLeft":
            column--;
            break;
          case "ArrowRight":
            column++;
            break;
          case "ArrowUp":
            row--;
            break;
          case "ArrowDown":
            row++;
            break;
          case "Home":
            column = 0;
            if (event.ctrlKey || event.metaKey) row = 0;
            break;
          case "End":
            column = columns - 1;
            if (event.ctrlKey || event.metaKey) row = rows - 1;
            break;
          default:
            return;
        }
        event.preventDefault();
        row = Math.max(0, Math.min(rows - 1, row));
        column = Math.max(0, Math.min(columns - 1, column));
        this.inspect(row, column);
        this.root
          .querySelector<SVGGraphicsElement>(
            `.pixel[data-row="${row}"][data-column="${column}"]`,
          )!
          .focus();
      },
      options,
    );
  }
}

if (!customElements.get("tensor-pixels"))
  customElements.define("tensor-pixels", TensorPixels);
