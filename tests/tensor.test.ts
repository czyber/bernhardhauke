import assert from "node:assert/strict";
import test from "node:test";
import {
  tensorFromNested,
  tensorOffset,
  tensorSlice,
  tensorDomain,
} from "../src/lib/tensor.ts";
import { tensorExample } from "../src/data/tensor-examples.ts";

test("nested data preserves row-major addresses from scalar through four dimensions", () => {
  assert.deepEqual(tensorFromNested(0.7), { shape: [], values: [0.7] });
  const data = tensorFromNested([
    [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [4, 5],
        [6, 7],
      ],
    ],
    [
      [
        [8, 9],
        [10, 11],
      ],
      [
        [12, 13],
        [14, 15],
      ],
    ],
  ]);
  assert.deepEqual(data.shape, [2, 2, 2, 2]);
  assert.equal(data.values[tensorOffset(data.shape, [1, 0, 1, 1])], 11);
  assert.deepEqual(tensorSlice(data, [1, 1]), {
    rows: 2,
    columns: 2,
    values: [12, 13, 14, 15],
  });
  assert.deepEqual(tensorSlice(tensorFromNested([2, 4, 6]), []), {
    rows: 1,
    columns: 3,
    values: [2, 4, 6],
  });
  assert.deepEqual(tensorSlice(tensorFromNested(7), []), {
    rows: 1,
    columns: 1,
    values: [7],
  });
});

test("malformed shapes and invalid slice addresses fail instead of silently mislabelling data", () => {
  for (const input of [
    [],
    [[1], [2, 3]],
    [1, [2]],
    [NaN],
    [Infinity],
    ["2"],
    Array(65).fill(1),
  ]) {
    assert.throws(() => tensorFromNested(input));
  }
  assert.throws(() => tensorOffset([2, 3], [2, 0]));
  assert.throws(() => tensorOffset([2, 3], [0, -1]));
  assert.throws(() => tensorOffset([2, 3], [0, 0.5]));
  assert.throws(() => tensorSlice(tensorExample("attention"), [0]));
});

test("causal attention rows normalize to one, never see the future, and vary across slices", () => {
  const tensor = tensorExample("attention");
  assert.equal(tensor.values.length, 2 * 3 * 8 * 8);
  for (let batch = 0; batch < 2; batch++)
    for (let head = 0; head < 3; head++) {
      const slice = tensorSlice(tensor, [batch, head]);
      for (let row = 0; row < 8; row++) {
        const values = slice.values.slice(row * 8, row * 8 + 8);
        assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 1) < 1e-12);
        assert.ok(
          values.every((value, key) => (key > row ? value === 0 : value > 0)),
        );
      }
    }
  assert.notDeepEqual(
    tensorSlice(tensor, [0, 0]).values,
    tensorSlice(tensor, [1, 0]).values,
  );
  assert.notDeepEqual(
    tensorSlice(tensor, [0, 0]).values,
    tensorSlice(tensor, [0, 1]).values,
  );
});

test("binary mask and global color domains keep their meaning across slices", () => {
  const mask = tensorExample("causal-mask");
  assert.equal(
    mask.values.reduce((a, b) => a + b, 0),
    36,
  );
  assert.equal(mask.values[tensorOffset(mask.shape, [3, 4])], 0);
  assert.equal(mask.values[tensorOffset(mask.shape, [3, 3])], 1);
  assert.deepEqual(tensorDomain(mask), [0, 1]);
  assert.deepEqual(
    tensorDomain({ values: [-3, 1], palette: "diverging" }),
    [-3, 3],
  );
  assert.deepEqual(
    tensorDomain({ values: [0, 0], palette: "sequential" }),
    [0, 1],
  );
  assert.deepEqual(
    tensorDomain({ values: [-2, -1], palette: "sequential" }),
    [-2, 0],
  );
  assert.throws(() => tensorExample("missing"));
});
