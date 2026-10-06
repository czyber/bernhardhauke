import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countNameBigrams,
  drawNextCharacter,
} from "../src/lib/bigram-counts.ts";

test("names contribute their own start and end pairs without joining names", () => {
  const model = countNameBigrams(["ana", "anna"]);
  assert.deepEqual(model.characters, [".", "a", "n"]);
  assert.deepEqual(model.counts, [
    [0, 2, 0],
    [2, 0, 2],
    [0, 2, 1],
  ]);
  assert.deepEqual(model.totals, [2, 4, 3]);
  assert.equal(
    model.totals.reduce((sum, count) => sum + count, 0),
    9,
  );
  assert.deepEqual(model.probabilities, [
    [0, 1, 0],
    [0.5, 0, 0.5],
    [0, 2 / 3, 1 / 3],
  ]);
  model.probabilities.forEach((row) =>
    assert.equal(
      row.reduce((sum, value) => sum + value, 0),
      1,
    ),
  );
});

test("uniform draws use each row's count intervals and never pick zero-count pairs", () => {
  const model = countNameBigrams(["ana", "anna"]);
  for (const draw of [0, 0.49, 0.5, 0.999999])
    assert.equal(drawNextCharacter(model, ".", draw), "a");
  assert.equal(drawNextCharacter(model, "a", 0), ".");
  assert.equal(drawNextCharacter(model, "a", 0.499999), ".");
  assert.equal(drawNextCharacter(model, "a", 0.5), "n");
  assert.equal(drawNextCharacter(model, "a", 0.999999), "n");
  assert.equal(drawNextCharacter(model, "n", 0), "a");
  assert.equal(drawNextCharacter(model, "n", 2 / 3), "n");
  assert.throws(() => drawNextCharacter(model, "z", 0.5), /current character/);
  for (const draw of [-0.1, 1, NaN])
    assert.throws(() => drawNextCharacter(model, "a", draw), /random draw/);
});

test("sampling can reproduce a whole boundary-to-boundary training name", () => {
  const model = countNameBigrams(["ana", "anna"]);
  let current = ".";
  const generated: string[] = [];
  for (const draw of [0.2, 0.9, 0.9, 0.1, 0.1]) {
    current = drawNextCharacter(model, current, draw);
    generated.push(current);
  }
  assert.deepEqual(generated, ["a", "n", "n", "a", "."]);
});
