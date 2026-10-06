# Tensor figures

Articles can use `<tensor-pixels>` directly in Markdown. It is a small, SVG-based
web component; it loads only on article pages containing a figure. It needs no
chart library, canvas, model runtime, or external service.

For computed operations embedded in LaTeX equations, see
[tensor equations](tensor-equations.md).

## Your own numbers

Supply a scalar or rectangular nested JSON array. Shape is inferred and values
are indexed in row-major order. Do not indent the HTML block in Markdown.

```html
<tensor-pixels
  name="weights"
  values="[[0.2,-0.4,0.8],[0.1,0.6,-0.3]]"
  axes="output,input"
  caption="Each row is an output feature; each column is an input feature."
>
  <p>Weights with shape [2, 3]. Rows: [0.2, -0.4, 0.8] and [0.1, 0.6, -0.3].</p>
</tensor-pixels>
```

- `name`: variable shown in the figure and in inspected addresses.
- `values`: JSON scalar or nested arrays; finite numbers only. Arrays must be
  rectangular and non-empty. Limits: 6 axes, 64 entries per axis, 65,536 values
  total. This is for explanatory tensors, not full model weight dumps.
- `axes`: comma-separated names, one per axis. Defaults to `axis 0`, `axis 1`, etc.
  Omit it for a scalar.
- `palette`: `diverging`, `sequential`, or `binary`. Signed data automatically
  uses diverging colors. Other data uses sequential colors. Binary accepts only
  0 and 1.
- `caption`: explanation below the figure; `$...$` supports inline LaTeX.
- `label`: optional display name, also supporting `$...$` math, independent of
  the variable's `name` used in addresses.
- `labels`: JSON arrays naming the entries along each axis, such as
  `[["hello","world"],["$f_1$","$f_2$","$f_3$"]]`. Each array must match its
  dimension; use `null` for unnamed axes. Context appears beside 2D grids and
  in inspected addresses and tables.
- `view="3d"`: start a rank-3 tensor in the SVG cuboid view. Rank-3 figures
  have a **Slices / 3D** switch; the default remains Slices. Other ranks keep
  their existing slice view.
- `compact`: presence of this attribute gives a small figure for scalar, vector,
  and matrix illustrations. It hides the controls, help, and table.
- `quiet`: keeps the normal-size grid, axis labels, and caption while hiding
  metadata, controls, the inspection readout, and the table disclosure.
- `show-values`: starts with the numbers visible in the cells, including in a
  quiet figure whose controls are hidden.

Write a descriptive paragraph inside every element. It remains readable without
JavaScript or if the component fails to load. The interactive figure replaces
it after initialization; use `caption` for text that should remain visible.

The last two axes form the displayed matrix. Earlier axes receive slice
selectors. Up to twelve slices also appear as clickable miniature grids.
Vectors are displayed as one row; a scalar as one square. A single color scale,
computed over the whole tensor, stays fixed between slices. Zero is the midpoint
of the diverging scale and the baseline of a nonnegative sequential scale.

The 3D view maps the first axis to depth, the second to rows, and the third
to columns. Each element is a solid voxel with three connected SVG faces, all
colored from that element's value. Front faces follow the color legend; the top
and side use light shading to make each cube's volume visible. Selecting a depth
removes earlier layers from view and reveals that layer's voxels. Only row and
column labels accompany the cube; the depth is shown in the shape and layer
selector. Occluded interior voxels are not rendered.
The same slice controls, inspector, keyboard navigation, and table remain
available. Readers can also reveal a layer and select an element by clicking an
exposed voxel, or focusing it and pressing Enter/Space. This uses only SVG paths
and transforms.

The voxels use the same 5-unit faces and 6-unit spacing as the 2D pixels, with a
shared rounded silhouette and a shortened depth projection. Value labels never
affect either view's geometry or scale.

Readers can hover, tap, or use arrow keys to inspect a value. Home/End move to
the edges of a row; Ctrl/Cmd+Home/End move to the corners of a matrix. Highlights
clear when the pointer or keyboard focus leaves a graphic, while the last value
remains in the inspector. `Show values`
adds rounded labels without changing the graphic's size in either view.
Large labels are replaced by a dot; the inspector and
accessible data table retain more precision. The table and inspector format
numbers to four decimal places or scientific notation for very small/large values.

## Included examples

```html
<tensor-pixels preset="cube" view="3d">
  <p>A [4, 4, 4] cube containing 0 through 63 in row-major order.</p>
</tensor-pixels>

<tensor-pixels preset="causal-mask">
  <p>An 8 × 8 matrix, with 1 on and below the diagonal and 0 above it.</p>
</tensor-pixels>

<tensor-pixels preset="embeddings">
  <p>Illustrative values with shape [2, 8, 16]: batch, token, feature.</p>
</tensor-pixels>

<tensor-pixels preset="attention">
  <p>
    Toy attention probabilities with shape [2, 3, 8, 8]: batch, head, query,
    key.
  </p>
</tensor-pixels>
```

Examples are defined in `src/data/tensor-examples.ts`. Embedding values are
illustrative. Attention probabilities are calculated from fixed toy queries
and keys with four features, causal masking, and row-wise softmax. They are not
recorded model activations. These toy dimensions keep each axis visible and
can differ from the model being discussed in an article.

Colors can be customized on the element through `--px-active`, `--px-negative`,
and `--px-inactive`. The rounded squares are inspired by
[Gegell's pixel matrices](https://gegell.github.io/posts/factorio-rng/); this
renderer draws values directly as SVG rectangles instead of using bitmap masks.
