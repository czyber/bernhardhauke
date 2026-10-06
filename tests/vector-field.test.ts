import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attentionGradient,
  embeddingGradient,
  fieldStep,
  vectorFieldExample,
} from "../src/lib/vector-field.ts";
import type { FieldSample } from "../src/lib/vector-field.ts";
import type { Vector2 } from "../src/lib/neural-examples.ts";

function checkGradient(
  evaluate: (point: Vector2) => FieldSample,
  point: Vector2,
) {
  const step = 1e-5;
  for (const axis of [0, 1]) {
    const low: Vector2 = [...point],
      high: Vector2 = [...point];
    low[axis] -= step;
    high[axis] += step;
    const finite = (evaluate(high).loss - evaluate(low).loss) / (2 * step);
    assert.ok(Math.abs(finite - evaluate(point).gradient[axis]) < 1e-7);
  }
}

test("embedding field differentiates cross-entropy through fixed readout weights", () => {
  const vectors: Vector2[] = [
    [0.5, -1],
    [1, 0],
    [0, 1],
  ];
  for (const target of [0, 1, 2]) {
    for (const point of [
      [-0.6, 0.8],
      [0, 0],
      [2, -1],
    ] as Vector2[]) {
      checkGradient(
        (position) => embeddingGradient(position, vectors, target),
        point,
      );
    }
  }
  const example = vectorFieldExample();
  const before = example.evaluate(example.initial);
  const after = example.evaluate(
    fieldStep(example.initial, before.gradient, example.rate),
  );
  assert.ok(Math.abs(before.loss - 2.2337296098881) < 1e-12);
  assert.ok(Math.abs(after.weights[0] - 0.17709154759470655) < 1e-12);
  assert.ok(after.loss < before.loss);
  // Identical scores produce equal probabilities and zero input gradient.
  const equal = embeddingGradient(
    [2, -3],
    [
      [1, 2],
      [1, 2],
    ],
    0,
  );
  assert.deepEqual(equal.gradient, [0, 0]);
  assert.deepEqual(equal.weights, [0.5, 0.5]);
});

test("attention field follows output error through values, softmax and query scores", () => {
  const keys: Vector2[] = [
    [1, 0],
    [0, 1],
    [-0.7, 0.3],
  ];
  const values: Vector2[] = [
    [2, 0],
    [0, 4],
    [1, -1],
  ];
  for (const target of [
    [0, 4],
    [0.3, 0.8],
  ] as Vector2[]) {
    for (const point of [
      [1, 0],
      [-2, 1.5],
      [0, 0],
    ] as Vector2[]) {
      checkGradient((q) => attentionGradient(q, keys, values, target), point);
    }
  }
  const example = vectorFieldExample({ mode: "attention" });
  const before = example.evaluate(example.initial);
  const after = example.evaluate(
    fieldStep(example.initial, before.gradient, example.rate),
  );
  assert.ok(Math.abs(before.loss - 4.485805329564439) < 1e-12);
  assert.ok(Math.abs(after.weights[1] - 0.4713931204144023) < 1e-12);
  assert.ok(after.loss < before.loss);
  // Equal value vectors make the output independent of q, even for unequal keys.
  const constant = attentionGradient(
    [0, 0],
    [
      [1, 0],
      [0, 1],
    ],
    [
      [1, 2],
      [1, 2],
    ],
    [0, 0],
  );
  assert.deepEqual(constant.gradient, [0, 0]);
  // Changing values changes the query gradient without changing attention weights.
  const changed = attentionGradient(
    [1, 0],
    [
      [1, 0],
      [0, 1],
    ],
    [
      [0, 4],
      [2, 0],
    ],
    [0, 4],
  );
  assert.deepEqual(changed.weights, before.weights);
  assert.ok(changed.gradient[0] < 0 && before.gradient[0] > 0);
});

test("field calculations remain finite for large permitted coordinates", () => {
  const example = vectorFieldExample({
    initial: [10, -10],
    extent: 10,
    vectors: [
      [10, -10],
      [-10, 10],
    ],
    target: 1,
  });
  const result = example.evaluate(example.initial);
  assert.ok(Number.isFinite(result.loss));
  assert.ok(result.gradient.every(Number.isFinite));
  assert.ok(Math.abs(result.loss - 400) < 1e-12);
  // The mathematical update remains exact; the UI must stop an out-of-view step.
  assert.deepEqual(fieldStep([3, 3], [-2, 1], 0.2), [3.4, 2.8]);
});

test("authoring errors fail instead of drawing a misleading field", () => {
  for (const options of [
    { mode: "made-up" },
    { initial: [NaN, 0] },
    { initial: [4, 0] },
    { extent: 0 },
    { rate: 0 },
    { rate: Infinity },
    { vectors: [[1, 0]] },
    {
      vectors: [
        [1, 0],
        [0, 1, 2],
      ],
    },
    { target: 4 },
    { target: "0" },
    { labels: ["only one"] },
    { mode: "attention", values: [[1, 0]] },
    { mode: "attention", target: [Infinity, 0] },
  ])
    assert.throws(() => vectorFieldExample(options));
});
