import assert from "node:assert/strict";
import test from "node:test";
import {
  attention2,
  dot,
  embeddingExample,
  gptStages,
  meanLoss,
  modelStages,
  sampleGradient,
  sampleIndex,
  sampleLoss,
  sgdSamples,
  sgdStep,
  vector2,
} from "../src/lib/neural-examples.ts";

test("token IDs gather the right rows, including repeated tokens", () => {
  const e = embeddingExample(
    ["the", "cat"],
    [0, 1, 0],
    [
      [1, -2],
      [3, 4],
    ],
  );
  assert.deepEqual(
    e.ids.map((id) => e.embeddings[id]),
    [
      [1, -2],
      [3, 4],
      [1, -2],
    ],
  );
  assert.throws(() => embeddingExample(["a"], [1], [[1, 2]]), /IDs/);
  assert.throws(
    () => embeddingExample(["a", "b"], [0], [[1], [2, 3]]),
    /width/,
  );
  assert.throws(() => embeddingExample(["a"], [0], [[Infinity]]), /finite/);
});

test("dot products preserve magnitude and sign; keys set weights and values set the mixture", () => {
  assert.equal(dot([2, 0], [3, 0]), 6);
  assert.equal(dot([1, 0], [0, 1]), 0);
  assert.equal(dot([1, 0], [-1, 0]), -1);
  const keys: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const values: [number, number][] = [
    [1, 0],
    [0, 1],
    [-0.5, 0.5],
  ];
  const result = attention2([Math.sqrt(2), 0], keys, values);
  assert.deepEqual(result.scores, [1, 0, -1]);
  assert.ok(Math.abs(result.weights[0] - 0.6652409557748218) < 1e-12);
  assert.ok(Math.abs(result.weights.reduce((a, b) => a + b) - 1) < 1e-12);
  assert.ok(Math.abs(result.output[0] - 0.6202256691896316) < 1e-12);
  const changed = attention2([Math.sqrt(2), 0], keys, [
    [0, 1],
    [0, 1],
    [0, 1],
  ]);
  assert.deepEqual(changed.weights, result.weights);
  assert.equal(changed.output[0], 0);
  assert.ok(Math.abs(changed.output[1] - 1) < 1e-12);
  const permuted = attention2(
    [Math.sqrt(2), 0],
    [...keys].reverse(),
    [...values].reverse(),
  );
  permuted.output.forEach((value, axis) =>
    assert.ok(Math.abs(value - result.output[axis]) < 1e-12),
  );
  assert.throws(() => vector2([NaN, 1]), /finite/);
  assert.throws(() => attention2([1, 0], keys, []), /per key/);
});

test("SGD differentiates the sampled loss, even when its update increases average loss", () => {
  const samples = sgdSamples([
    [1, 2],
    [2, 3],
    [3, 6],
  ]);
  const epsilon = 1e-5,
    weight = 0.4;
  const numeric =
    (sampleLoss(weight + epsilon, samples[1]) -
      sampleLoss(weight - epsilon, samples[1])) /
    (2 * epsilon);
  assert.ok(Math.abs(numeric - sampleGradient(weight, samples[1])) < 1e-8);
  assert.ok(Math.abs(sgdStep(weight, samples[1], 0.1).after - 0.84) < 1e-12);
  const optimum = 26 / 14;
  const next = sgdStep(optimum, samples[0], 0.05).after;
  assert.ok(sampleLoss(next, samples[0]) < sampleLoss(optimum, samples[0]));
  assert.ok(meanLoss(next, samples) > meanLoss(optimum, samples));
  assert.throws(
    () =>
      sgdSamples([
        [0, 1],
        [1, 2],
      ]),
    /pairs/,
  );
  assert.throws(() => sgdStep(0, samples[0], 0), /positive/);
});

test("seeded sampling is repeatable and can sample an example more than once", () => {
  const sequence = () => {
    let seed = 7;
    return Array.from({ length: 12 }, () => {
      const next = sampleIndex(seed, 3);
      seed = next.seed;
      return next.index;
    });
  };
  assert.deepEqual(sequence(), sequence());
  assert.deepEqual(sequence().slice(0, 4), [0, 2, 1, 2]);
  assert.ok(sequence().every((i) => i >= 0 && i < 3));
});

test("model stages preserve the GPT shape path and reject invalid declarations", () => {
  const stages = gptStages(4);
  assert.equal(stages[2].label, "Block × 4");
  assert.equal(stages[1].shape, stages[2].shape);
  assert.match(stages.at(-1)!.shape, /V/);
  assert.equal(modelStages(stages).length, 5);
  assert.throws(() => gptStages(0), /blocks/);
  assert.throws(() => modelStages([{ label: "a", shape: "x" }]), /note/);
});
