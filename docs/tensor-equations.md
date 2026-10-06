# Tensor equations

Use `<tensor-equation>` to put real tensor figures inside mathematical notation.
The existing `<tensor-pixels>` renderer supplies the squares, cubes, inspection,
and keyboard navigation. Result tensors are computed from their inputs.

Worked examples used by the PyTorch checks live in
`tests/fixtures/tensor-equations.html`.

## A matrix and its transpose

Paste this directly into an article's Markdown. Keep the HTML block unindented,
with no blank lines inside it. Use single quotes around JSON containing strings.
HTML attributes take ordinary LaTeX backslashes; JSON strings need doubled ones.

```html
<tensor-equation
  formula="A = {{a}} \qquad A^{\mathsf{T}} = {{at}}"
  show-values
  caption="$A^{\mathsf{T}}_{j,i}=A_{i,j}$"
>
  <tensor-pixels
    name="a"
    values="[[1,2,3],[4,5,6]]"
    axes="token,feature"
    labels='[["hello","world"],["$f_1$","$f_2$","$f_3$"]]'
    caption="$A \in \mathbb{R}^{2\times3}$"
  ></tensor-pixels>
  <tensor-pixels
    name="at"
    op="transpose"
    inputs="a"
    caption="$A^{\mathsf{T}} \in \mathbb{R}^{3\times2}$"
  ></tensor-pixels>
  <p>
    A has rows [1, 2, 3] and [4, 5, 6]. Its transpose has rows [1, 4], [2, 5],
    and [3, 6].
  </p>
</tensor-equation>
```

`{{a}}` inserts the tensor named `a`. Everything between tensor placeholders is
LaTeX: `+`, equals signs, arrows, `\cdot`, `\otimes`, superscripts, and ordinary math.
Each piece must be a complete LaTeX fragment. Use ordinary `(` and `)` across
tensor placeholders, rather than opening `\left(` in one fragment and closing
`\right)` in another.

Names are scoped to one equation. They must be unique identifiers such as `a`,
`qkv`, or `heads`. Declare a tensor once; refer to it by name in computed terms.
Input declarations may appear after their dependents. Cycles, missing inputs,
and incompatible shapes produce a visible error, never a fabricated result.
Place each named tensor at most once in a formula. You can omit intermediate
terms from the formula while still using them in later operations.

## Addition and position encodings

Use `op="add"` for element-wise `+`. The result is calculated automatically;
inspecting a result square highlights its two inputs and displays their sum.

```html
<tensor-equation
  formula="{{tokens}} + {{positions}} = {{encoded}}"
  show-values
  caption="$X_{t,c}=E_{t,c}+P_{t,c}$"
>
  <tensor-pixels
    name="tokens"
    label="$E$"
    values="[[1,2,0],[0,1,3]]"
    axes="position,feature"
    caption="Token embeddings"
  ></tensor-pixels>
  <tensor-pixels
    name="positions"
    label="$P$"
    values="[[0,1,0],[1,0,1]]"
    axes="position,feature"
    caption="Position encodings"
  ></tensor-pixels>
  <tensor-pixels
    name="encoded"
    label="$X$"
    op="add"
    inputs="tokens,positions"
    caption="Combined input"
  ></tensor-pixels>
  <p>The combined input has rows [1, 3, 0] and [1, 1, 4].</p>
</tensor-equation>
```

Addition supports broadcasting: shapes align from the right, and each pair of
sizes must match or one must be `1`. Scalars work too. For batched embeddings,
use token values shaped `[B, T, C]` and position values shaped `[T, C]` (or
`[1, T, C]`). The position values are reused across every batch slice; the
test fixtures include a working example. Matching `[B, T, C]` inputs can illustrate
residual additions with the same component.
Batch slice controls stay synchronized along shared leading axes of an
addition. Switching the token or result batch therefore keeps the equation
consistent; a broadcast singleton remains at index zero.

## Matrix multiplication

```html
<tensor-equation
  formula="{{a}} \cdot {{b}} = {{c}}"
  show-values
  caption="$C_{i,j}=\sum_k A_{i,k}B_{k,j}$"
>
  <tensor-pixels
    name="a"
    label="$A$"
    values="[[1,2,0],[0,1,3]]"
    axes="token,feature"
    caption="Input features"
  ></tensor-pixels>
  <tensor-pixels
    name="b"
    label="$B$"
    values="[[1,0],[0,2],[1,1]]"
    axes="feature,output"
    caption="Projection weights"
  ></tensor-pixels>
  <tensor-pixels
    name="c"
    label="$C$"
    op="matmul"
    inputs="a,b"
    caption="Projected tokens"
  ></tensor-pixels>
  <p>The product has rows [1, 4] and [3, 5].</p>
</tensor-equation>
```

Inspect a result square to highlight its contributing input row and column and
see the actual sum of products. Views, transposes, splits, and contiguous copies
link matching entries in both directions. Highlights clear on pointer or focus
exit. A shared color domain ensures that the same value has the same color
across the equation. Each term keeps its size when values are toggled.

## Operations

Use `op` and `inputs` on a computed `<tensor-pixels>`. Do not provide `values`
for a computed result. Lists below are comma-separated attributes.

| Operation             | Example attributes                                         | Behavior                                                                                 |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.view`               | `op="view" inputs="a" shape="2,2,-1"`                      | Preserves values and storage addresses. One dimension may be inferred with `-1`.         |
| `.reshape`            | `op="reshape" inputs="a" shape="6"`                        | Uses the logical value order; may copy when a view is incompatible.                      |
| Transpose             | `op="transpose" inputs="a" dims="0,2"`                     | Swaps two axes, their labels, and their strides. Defaults to the last two axes.          |
| Split                 | `op="split" inputs="qkv" axis="-1" sizes="2,2,2" part="1"` | Selects one split, here the middle group. Declare each desired part separately.          |
| Addition              | `op="add" inputs="tokens,positions"`                       | Element-wise sum with trailing-axis broadcasting, including scalar and singleton axes.   |
| Matrix multiplication | `op="matmul" inputs="a,b"`                                 | Two rank-2 matrices; the inner dimensions must match.                                    |
| Kronecker product     | `op="kron" inputs="a,b"`                                   | Two rank-2 matrices; each entry in the first scales a block of the second.               |
| Contiguous copy       | `op="contiguous" inputs="a"`                               | Preserves logical values and gives them contiguous strides, ready for a subsequent view. |

Negative axes count from the end. Split sizes must cover their axis exactly.
Shapes allow up to six axes and 64 entries per axis. An equation allows up to
24 tensors and 65,536 values across them. Matrix multiplication is currently
rank 2; this is a small educational renderer rather than a tensor runtime.

A view is not a transpose. The evaluator checks every element's storage address
against the proposed strides. This handles compatible non-contiguous slices,
such as splitting Q/K/V and then viewing a feature axis as heads. It rejects
incompatible views after a transpose. See [PyTorch's view semantics](https://docs.pytorch.org/docs/stable/generated/torch.Tensor.view.html).

## Context and LaTeX

Every term supports these optional attributes:

- `label="$Q^{\mathsf{T}}$"`: display math above that tensor. Omit it when the
  formula already supplies the symbol.
- `caption="Queries $\in \mathbb{R}^{T\times d}$"`: prose and math under that
  tensor. The outer equation has an independent `caption` too.
- `axes="token,feature"`: the meaning of each axis, in order. `$...$` math is
  supported in axis titles.
- `labels='[["hello","world"],["$f_1$","$f_2$","$f_3$"]]'`: names for each
  entry along an axis. Use `null` for unnamed axes. Labels appear beside grids,
  in the inspector, and in the standalone figure's data table. Longer column
  names rotate so they don't enlarge the cells; very long names are abbreviated
  visually and remain available in the inspector.
- `view="3d"`: show a rank-3 term as the same rounded cube used by standalone
  figures. The layer selector stays available.

Transpose and split carry axis context forward automatically. Matrix products
inherit the left operand's row context and the right operand's column context.
Addition takes each axis's context from an operand with that full axis size,
so a singleton's label is not repeated across an expanded axis. When both
operands supply the full axis, the left operand takes precedence, with missing
entry labels filled from the right. Explicit result attributes override this.
A view with a new shape needs new axis meanings; it cannot infer what a new
head or batch axis means. Set `axes` and `labels` on that result explicitly.
These context and math attributes work on standalone `<tensor-pixels>` too.

The `formula` attribute is entirely LaTeX except for tensor placeholders.
Captions, labels, and axis titles are prose with `$...$` or `$$...$$` math.
KaTeX and its fonts load locally only when needed. Rendering includes accessible
MathML and keeps untrusted HTML and external-resource commands disabled. See
the [KaTeX options](https://katex.org/docs/options.html) for its supported scope.

## Working examples and fallback

The **Equivalent PyTorch** disclosure is generated from the same declarations
as the figure, including complete input values. It can be copied into a Python
session with PyTorch installed. The browser computes in JavaScript using double
precision; printed labels are rounded for readability. This is not live Python
execution, and it does not load a model or a 3D library.

Include a descriptive `<p>` inside every equation, explaining the inputs and
result. It remains visible without JavaScript or if the equation cannot load.
On narrow screens the equation scrolls horizontally as one expression, while
its explanation and controls fit the reading column.

Run the numeric checks with `npm test`. With PyTorch installed, run
`python3 -m unittest discover -s tests -p 'test_tensor_equations.py'` to compare
every fixture equation and its generated code with actual PyTorch results.
