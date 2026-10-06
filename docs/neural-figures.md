# Neural network figures

Small web components complement the existing tensor figures. They load
only on articles that use them, share the blog's fonts and colors, and use HTML
and SVG. There is no plotting, 3D, or model runtime dependency. LaTeX captions
use the existing local KaTeX renderer.

Several figures are used in `/articles/a-month-of-teaching-a-model-to-talk/`.

Use `bare` when the surrounding article explains a figure. This removes
figure dividers, captions, hints, and optional disclosures while retaining
the visual and essential controls. Bigram counts also hides its explanatory
text; token lookup hides the redundant readout; embedding training shows
only the animated coordinates, update count, and playback controls. Put the
dataset and teaching-model context into prose when using this mode.

## Bigram counts

`<bigram-counts>` counts character pairs in the teaching names `ana` and
`anna`, including start/end boundaries. The matrix, probability bars, and
one-character sampler use the same count data. Selecting a row starts a
continuation from that character; Reset starts a new name at the boundary.
This is a teaching example, not a measurement from a training checkpoint.

```html
<bigram-counts>
  <p>After a: two endings and two n characters, each with probability 1/2.</p>
</bigram-counts>
```

## Token embeddings

```html
<token-embeddings
  vocabulary='["the","cat","sat"]'
  ids="[0,1,2,0]"
  embeddings="[[0.2,-0.5,0.8,0.1],[0.7,0.1,-0.3,0.6],[-0.4,0.6,0.2,0.5]]"
  caption="Look up a row of $E$."
>
  <p>IDs 0, 1, 2, 0 select the embedding rows for the, cat, sat, the.</p>
</token-embeddings>
```

Inspect a token or an embedding row to see the selected vector. Repeated IDs
highlight together. Pointer and focus exit clear highlights. Arrow keys move
between tokens. The table and output use the existing `tensor-pixels` renderer
with a shared color scale. Values are hidden by default; the Details disclosure
contains Show values. An optional `show-values` attribute starts with numbers
visible, without changing the cell sizes.

`compact` hides the optional Details disclosure. Pair it with `show-values`
when the article should display the numbers immediately.

`vocabulary` is an array of 1–12 strings; `ids` is a sequence of up to 24 valid
row indices; `embeddings` is one equally sized row per vocabulary entry, with
1–16 finite features between −100 and 100. Token strings are literal text,
including whitespace. Authors supply tokenization and example embeddings;
this figure does not run a tokenizer or invent learned representations.

## Watching embeddings learn

`<embedding-training>` replays 600 deterministic full-batch gradient updates
of a tiny next-token model. Its six input embeddings have two coordinates;
the output weights and biases learn jointly by cross-entropy on the 96
observed pairs displayed in the figure. Points are actual embedding values,
not a dimensionality reduction or a scripted clustering animation. Axes are
fixed across the whole history. Readers can select words, play/pause, reset,
or scrub updates. Initialization uses seed 17.

The alternative `<vector-field compact mode="embedding">` isolates a single embedding update
with the output weights held fixed. `compact` hides its optional disclosure;
put the relevant assumptions in the article text.

## Stochastic gradient descent

```html
<sgd-step
  samples="[[1,2],[2,3],[3,6]]"
  weight="0"
  seed="7"
  caption="Learn one weight in $\hat y=wx$."
>
  <p>Each step samples an (x, y) pair and updates w using its gradient.</p>
</sgd-step>
```

The model is `prediction = w*x`, with sample loss `0.5*(w*x-y)^2` and gradient
`x*(w*x-y)`. Take one step samples **with replacement**, applies the update,
and shows the arithmetic. The plot displays average loss over the whole data
set; that loss can increase on an individual stochastic step. Nothing runs
automatically. Reset repeats the seeded sample sequence.

- `samples`: 2–12 `[x, y]` pairs. Require `0.25 ≤ |x| ≤ 10` and `|y| ≤ 20`.
- `weight`: initial weight, default 0, between −20 and 20.
- `seed`: integer from 0 to 4294967295, default 7.
- `rate`: optional learning rate; defaults to `min(0.05, 0.5 / max(x²))`. The upper bound
  is `1 / max(x²)` so this tiny scalar example stays within its fixed plot.
  The rate control lives in Details.

The fixed axes are derived from the data and initial weight. They never
rescale between steps. This is a deliberately small SGD example, not a neural
network trainer; use prose to connect squared error to a language model's loss.

## Vectors and Q/K/V

The default is just two vectors and their dot product:

```html
<vector-attention
  query="[1,0.5]"
  keys="[[1,0]]"
  caption="$q\cdot k=q_xk_x+q_yk_y$."
>
  <p>The initial dot product is 1.</p>
</vector-attention>
```

Drag the query tip or focus it and use arrow keys (0.1 per press; Shift uses
0.5). All geometry and arithmetic update together on fixed axes. Reset query
is in Details. There are no animation, view, or playback controls.

QKV mode adds keys, values, and the resulting mixture:

```html
<vector-attention
  mode="qkv"
  query="[1,0.5]"
  keys="[[1,0],[0,1],[-1,0]]"
  values="[[1,0],[0,1],[-0.5,0.5]]"
  labels='["the","cat","sat"]'
  caption="$o=\sum_i a_i v_i$."
>
  <p>
    Scaled query–key dot products become weights that mix the corresponding
    values.
  </p>
</vector-attention>
```

Coordinates are finite numbers in [−10, 10]. Dot mode takes one key; QKV mode
supports 1–4 keys with one value and optional plain-text label per key. QKV mode
computes `scores = dot(q, k) / sqrt(2)`, stable softmax, and the weighted value
sum. Details contains the equation, coordinates, scores, and weights.

This is one two-dimensional query with all keys available, not a projection
of a larger trained model. Explain masking and learned Q/K/V projections in
the article using the tensor figures. Colors identify roles, not semantic
categories. The numeric weights are the source of truth.

## Learning vector fields

`vector-field` shows a two-coordinate vector, a sparse field of downhill
directions, and a trail of real gradient updates. Its default is one trainable
embedding row feeding a fixed three-token vocabulary readout:

```html
<vector-field mode="embedding" caption="An error changes a row of $E$.">
  <p>One update raises blue's probability from 10.7% to 17.7%.</p>
</vector-field>
```

The embedding scores are `z[i] = dot(e, readout[i])`. Loss is negative log
probability of the target token, and the exact gradient is
`sum((p[i] - oneHotTarget[i]) * readout[i])`. Only the embedding row changes.
This is not an attraction animation toward a hand-picked semantic location.

Attention mode differentiates a squared output error back into one query:

```html
<vector-field
  mode="attention"
  initial="[1,0]"
  vectors="[[1,0],[0,1]]"
  values="[[2,0],[0,4]]"
  target="[0,4]"
  caption="The error in $o$ determines the gradient of $q$."
>
  <p>One step raises the second value's weight from 33.0% to 47.1%.</p>
</vector-field>
```

The calculation is scaled query–key dot products, softmax, a weighted sum of
values, and `0.5 * squaredDistance(output, target)`. Keys and values are fixed.
The query gradient is calculated analytically through all these operations;
no desired attention pattern is supplied. Explain in the article that a real
transformer updates the weights producing Q/K/V, rather than optimizing a
stored query activation directly.

Authoring attributes:

- `mode`: `embedding` (default) or `attention`.
- `initial`: two coordinates, default `[-0.6,0.8]` for embeddings or `[1,0]`
  for attention. Must fit inside the fixed axes.
- `vectors`: 2–4 two-coordinate readout vectors (embedding mode) or keys
  (attention mode). Readout defaults to `[[0.5,-1],[1,0],[0,1]]`; keys to
  `[[1,0],[0,1]]`.
- `values`: one vector per key; attention only, default `[[2,0],[0,4]]`.
- `target`: the correct readout index for embedding mode (default `0`), or
  the desired output vector for attention (default `[0,4]`).
- `labels`: one plain-text label per readout/key, at most 32 characters.
- `rate`: fixed learning rate in `(0,1]`, default `0.2`.
- `extent`: axes cover `[-extent,extent]` in both directions, default `3`;
  allowed range `0.5–10`. Coordinates are finite and in `[-10,10]`.
- `caption`: text with optional `$...$` LaTeX, as in the other figures.

Readers can drag the point or use arrow keys (0.1, or 0.5 with Shift), take
one step, and reset. Moving the point starts a new trail. Faint arrows have
equal lengths and show **negative-gradient direction**, not update magnitude.
Details contains the actual equations, fixed vectors, current gradient, and
a checkbox to hide the field without changing any geometry.

No animation starts automatically. Plot axes never rescale. An update outside
the fixed view is stopped with a message, not clamped into a false gradient
step. A stationary gradient disables stepping. Loss is not guaranteed to
decrease for every author-supplied learning rate or example.

## Model diagram

```html
<model-diagram layers="2" caption="From token IDs to vocabulary logits.">
  <p>
    Embeddings, two transformer blocks, final normalization, and vocabulary
    projection.
  </p>
</model-diagram>
```

The default GPT-2-style diagram uses symbolic B/T/C/V shapes. `layers` is the
number of blocks (1–96; default 2). Inspect a stage to read its explanation;
arrow keys move between stages. The collapsed block detail shows pre-LayerNorm,
attention, the GELU MLP, and the two residual branches. Highlights clear on exit.

Set `activation="relu"` for a `Linear → ReLU → Linear` feed-forward layer;
the default is `activation="gelu"`. The ReLU option uses a generic learned
vocabulary projection note without the default GPT-2 weight-tying explanation.
Custom `stages` retain their own notes.

A custom linear model diagram uses `stages` instead:

```html
<model-diagram
  stages='[{"label":"Input","shape":"$B\\times C$","note":"One vector per example."},{"label":"Linear","shape":"$B\\times H$","note":"A learned projection.","href":"#linear-layer"},{"label":"Output","shape":"$B\\times V$","note":"One score per class."}]'
  caption="A small model."
>
  <p>Input vectors pass through a linear layer to produce class scores.</p>
</model-diagram>
```

Provide 1–8 stages with `label`, `shape`, and `note`. All support `$...$` math.
Optional `href` links the explanation to an article section or code note;
only HTTP(S) and relative links are accepted. Custom diagrams have no GPT block
detail. On narrow screens only the diagram scrolls; its prose fits the article.

## Shared authoring rules

Put the HTML directly in Markdown, unindented, with no blank lines inside the
block. Use single quotes around JSON containing strings. HTML math attributes
use ordinary backslashes; JSON strings need doubled backslashes. Every figure
supports `caption` with prose and `$...$` LaTeX.

Include a descriptive fallback paragraph in every element. It stays readable
without JavaScript or when data is invalid. Essential math and computed values
remain available as text, alongside keyboard controls. Keep examples small;
additional derivations belong in prose or the existing tensor equations.

Run `npm test` for numeric and validation checks, and `npm run build` for the
article and component checks.
