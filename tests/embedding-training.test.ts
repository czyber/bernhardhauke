import assert from "node:assert/strict";
import { test } from "node:test";
import {
  embeddingTrainingHistory,
  evaluateEmbeddingTraining,
  initialEmbeddingParameters,
  stepEmbeddingTraining,
} from "../src/lib/embedding-training.ts";
import type { EmbeddingParameters } from "../src/lib/embedding-training.ts";

const copy = (parameters: EmbeddingParameters): EmbeddingParameters => ({
  embeddings: parameters.embeddings.map((point) => [...point]),
  readout: parameters.readout.map((point) => [...point]),
  bias: [...parameters.bias],
});

test("embedding and learned readout gradients agree with finite differences", () => {
  const parameters = initialEmbeddingParameters();
  const { gradient } = evaluateEmbeddingTraining(parameters);
  const epsilon = 1e-5;
  for (const name of ["embeddings", "readout"] as const) {
    parameters[name].forEach((point, row) => {
      point.forEach((_, axis) => {
        const low = copy(parameters),
          high = copy(parameters);
        low[name][row][axis] -= epsilon;
        high[name][row][axis] += epsilon;
        const finite =
          (evaluateEmbeddingTraining(high).loss -
            evaluateEmbeddingTraining(low).loss) /
          (2 * epsilon);
        assert.ok(Math.abs(finite - gradient[name][row][axis]) < 1e-8);
      });
    });
  }
  parameters.bias.forEach((_, output) => {
    const low = copy(parameters),
      high = copy(parameters);
    low.bias[output] -= epsilon;
    high.bias[output] += epsilon;
    const finite =
      (evaluateEmbeddingTraining(high).loss -
        evaluateEmbeddingTraining(low).loss) /
      (2 * epsilon);
    assert.ok(Math.abs(finite - gradient.bias[output]) < 1e-8);
  });
});

test("joint gradient updates lower prediction loss and change both learned tables", () => {
  const before = initialEmbeddingParameters();
  const unchanged = copy(before);
  const after = stepEmbeddingTraining(before);
  assert.ok(
    evaluateEmbeddingTraining(after).loss <
      evaluateEmbeddingTraining(before).loss,
  );
  assert.notDeepEqual(after.embeddings, before.embeddings);
  assert.notDeepEqual(after.readout, before.readout);
  assert.deepEqual(before, unchanged);
  const history = embeddingTrainingHistory();
  assert.ok(history.at(-1)!.loss < history[0].loss - 0.5);
  for (const snapshot of history) {
    assert.ok(Number.isFinite(snapshot.loss));
    snapshot.probabilities.forEach((row) => {
      assert.ok(row.every((value) => value >= 0 && value <= 1));
      assert.ok(
        Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 1e-12,
      );
    });
  }
});

test("the displayed training history is reproducible from its seed", () => {
  assert.deepEqual(
    embeddingTrainingHistory(10, 17),
    embeddingTrainingHistory(10, 17),
  );
  assert.notDeepEqual(
    embeddingTrainingHistory(10, 17)[0].embeddings,
    embeddingTrainingHistory(10, 18)[0].embeddings,
  );
});
