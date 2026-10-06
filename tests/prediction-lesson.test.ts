import assert from "node:assert/strict";
import { test } from "node:test";
import { predictionExample } from "../src/lib/prediction-lesson.ts";

test("the lesson's probability, loss, and gradient agree with finite differences", () => {
  const example = predictionExample(Math.log(2));
  assert.deepEqual(example.probabilities, [0.5, 0.25, 0.25]);
  assert.ok(Math.abs(example.loss - Math.log(2)) < 1e-12);
  for (const score of [-4, 0, Math.log(2), 8]) {
    const epsilon = 1e-5;
    const finite =
      (predictionExample(score + epsilon).loss -
        predictionExample(score - epsilon).loss) /
      (2 * epsilon);
    assert.ok(Math.abs(finite - predictionExample(score).gradient) < 1e-8);
  }
  assert.ok(predictionExample(Math.log(2) + 0.25).loss < example.loss);
});

test("large finite logits do not overflow the teaching calculation", () => {
  for (const score of [-1000, 1000]) {
    const result = predictionExample(score);
    assert.ok(Number.isFinite(result.loss));
    assert.ok(
      Math.abs(result.probabilities.reduce((a, b) => a + b) - 1) < 1e-12,
    );
  }
});
