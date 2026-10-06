import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTensors, tensorPython } from "../src/lib/tensor-operations.ts";
import { tensorLabels } from "../src/lib/tensor.ts";

test("transpose moves values, labels, strides, and provenance together", () => {
  const tensors = evaluateTensors([
    {
      name: "a",
      values: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      axes: ["token", "feature"],
      labels: [
        ["hello", "world"],
        ["x", "y", "z"],
      ],
    },
    { name: "at", op: "transpose", inputs: ["a"] },
    { name: "back", op: "transpose", inputs: ["at"] },
  ]);
  const at = tensors.get("at")!;
  assert.deepEqual(at.shape, [3, 2]);
  assert.deepEqual(at.values, [1, 4, 2, 5, 3, 6]);
  assert.deepEqual(at.strides, [1, 3]);
  assert.deepEqual(at.axes, ["feature", "token"]);
  assert.deepEqual(at.labels, [
    ["x", "y", "z"],
    ["hello", "world"],
  ]);
  assert.deepEqual(at.sources(3), [{ name: "a", index: 4 }]);
  assert.deepEqual(tensors.get("back")!.values, tensors.get("a")!.values);
});

test("view infers a dimension and rejects incompatible storage instead of pretending to transpose", () => {
  const a = {
    name: "a",
    values: [
      [1, 2, 3],
      [4, 5, 6],
    ],
  };
  const transpose = { name: "at", op: "transpose" as const, inputs: ["a"] };
  const result = evaluateTensors([
    a,
    { name: "v", op: "view", inputs: ["a"], shape: [3, -1] },
  ]).get("v")!;
  assert.deepEqual(result.shape, [3, 2]);
  assert.deepEqual(result.values, [1, 2, 3, 4, 5, 6]);
  assert.throws(
    () =>
      evaluateTensors([
        a,
        transpose,
        { name: "v", op: "view", inputs: ["at"], shape: [6] },
      ]),
    /strides/,
  );
  const tensors = evaluateTensors([
    a,
    transpose,
    { name: "c", op: "contiguous", inputs: ["at"] },
    { name: "v", op: "view", inputs: ["c"], shape: [6] },
    { name: "r", op: "reshape", inputs: ["at"], shape: [6] },
  ]);
  assert.deepEqual(tensors.get("v")!.values, [1, 4, 2, 5, 3, 6]);
  assert.deepEqual(tensors.get("r")!.values, tensors.get("v")!.values);
  assert.throws(
    () =>
      evaluateTensors([
        a,
        { name: "v", op: "view", inputs: ["a"], shape: [-1, -1] },
      ]),
    /one inferred/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        a,
        { name: "v", op: "view", inputs: ["a"], shape: [4, 2] },
      ]),
    /preserve/,
  );
});

test("split preserves row boundaries and permits compatible views of non-contiguous slices", () => {
  const tensors = evaluateTensors([
    {
      name: "a",
      values: [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10, 11],
      ],
      labels: [
        ["one", "two"],
        ["q0", "q1", "k0", "k1", "v0", "v1"],
      ],
    },
    {
      name: "k",
      op: "split",
      inputs: ["a"],
      sizes: [2, 2, 2],
      axis: -1,
      part: 1,
    },
    { name: "heads", op: "view", inputs: ["k"], shape: [2, 2, 1] },
  ]);
  const k = tensors.get("k")!;
  assert.deepEqual(k.values, [2, 3, 8, 9]);
  assert.deepEqual(k.labels, [
    ["one", "two"],
    ["k0", "k1"],
  ]);
  assert.deepEqual(k.strides, [6, 1]);
  assert.deepEqual(k.sources(2), [{ name: "a", index: 8 }]);
  assert.deepEqual(tensors.get("heads")!.values, k.values);
});

test("matrix and Kronecker products compute distinct results and contributing cells", () => {
  const matrices = [
    {
      name: "a",
      values: [
        [1, 2, 0],
        [0, 1, 3],
      ],
      axes: ["token", "feature"],
    },
    {
      name: "b",
      values: [
        [1, 0],
        [0, 2],
        [1, 1],
      ],
      axes: ["feature", "output"],
    },
  ];
  const c = evaluateTensors([
    ...matrices,
    { name: "c", op: "matmul", inputs: ["a", "b"] },
  ]).get("c")!;
  assert.deepEqual(c.values, [1, 4, 3, 5]);
  assert.deepEqual(c.axes, ["token", "output"]);
  assert.deepEqual(c.sources(3), [
    { name: "a", index: 3 },
    { name: "b", index: 1 },
    { name: "a", index: 4 },
    { name: "b", index: 3 },
    { name: "a", index: 5 },
    { name: "b", index: 5 },
  ]);
  const kron = evaluateTensors([
    {
      name: "a",
      values: [
        [1, 2],
        [3, 4],
      ],
    },
    {
      name: "b",
      values: [
        [1, 0],
        [0, 1],
      ],
    },
    { name: "c", op: "kron", inputs: ["a", "b"] },
  ]).get("c")!;
  assert.deepEqual(kron.shape, [4, 4]);
  assert.deepEqual(
    kron.values,
    [1, 0, 2, 0, 0, 1, 0, 2, 3, 0, 4, 0, 0, 3, 0, 4],
  );
  assert.deepEqual(kron.sources(15), [
    { name: "a", index: 3 },
    { name: "b", index: 3 },
  ]);
  assert.throws(
    () =>
      evaluateTensors([
        ...matrices,
        { name: "bad", op: "matmul", inputs: ["a", "a"] },
      ]),
    /inner dimensions/,
  );
});

test("addition broadcasts positions over a batch and traces each result to two inputs", () => {
  const tensors = evaluateTensors([
    {
      name: "tokens",
      values: [
        [
          [1, 2, 0],
          [0, 1, 3],
        ],
        [
          [2, 0, 1],
          [1, 3, 2],
        ],
      ],
      axes: ["batch", "position", "feature"],
      labels: [["first", "second"], ["t0", "t1"], null],
    },
    {
      name: "positions",
      values: [
        [0, 1, 0],
        [1, 0, 1],
      ],
      axes: ["position", "feature"],
      labels: [
        ["p0", "p1"],
        ["f0", "f1", "f2"],
      ],
    },
    { name: "encoded", op: "add", inputs: ["tokens", "positions"] },
    { name: "reversed", op: "add", inputs: ["positions", "tokens"] },
  ]);
  const result = tensors.get("encoded")!;
  assert.deepEqual(result.shape, [2, 2, 3]);
  assert.deepEqual(result.values, [1, 3, 0, 1, 1, 4, 2, 1, 1, 2, 3, 3]);
  assert.deepEqual(result.axes, ["batch", "position", "feature"]);
  assert.deepEqual(result.labels, [
    ["first", "second"],
    ["t0", "t1"],
    ["f0", "f1", "f2"],
  ]);
  assert.deepEqual(result.sources(5), [
    { name: "tokens", index: 5 },
    { name: "positions", index: 5 },
  ]);
  assert.deepEqual(result.sources(11), [
    { name: "tokens", index: 11 },
    { name: "positions", index: 5 },
  ]);
  assert.deepEqual(tensors.get("reversed")!.values, result.values);
  assert.match(tensorPython(tensors), /encoded = tokens \+ positions/);
});

test("addition expands singleton axes, inherits their full context, and accepts scalars", () => {
  const tensors = evaluateTensors([
    {
      name: "rows",
      values: [[1], [2]],
      axes: ["token", "singleton"],
      labels: [["a", "b"], ["one"]],
    },
    {
      name: "columns",
      values: [[10, 20, 30]],
      axes: ["singleton", "feature"],
      labels: [["one"], ["x", "y", "z"]],
    },
    { name: "grid", op: "add", inputs: ["rows", "columns"] },
    { name: "bias", values: -0.5 },
    { name: "shifted", op: "add", inputs: ["bias", "grid"] },
    { name: "scalar", op: "add", inputs: ["bias", "bias"] },
  ]);
  const grid = tensors.get("grid")!;
  assert.deepEqual(grid.values, [11, 21, 31, 12, 22, 32]);
  assert.deepEqual(grid.axes, ["token", "feature"]);
  assert.deepEqual(grid.labels, [
    ["a", "b"],
    ["x", "y", "z"],
  ]);
  assert.deepEqual(grid.sources(4), [
    { name: "rows", index: 1 },
    { name: "columns", index: 1 },
  ]);
  const shifted = tensors.get("shifted")!;
  assert.deepEqual(shifted.shape, [2, 3]);
  assert.deepEqual(shifted.values, [10.5, 20.5, 30.5, 11.5, 21.5, 31.5]);
  assert.deepEqual(shifted.sources(4), [
    { name: "bias", index: 0 },
    { name: "grid", index: 4 },
  ]);
  assert.deepEqual(shifted.axes, grid.axes);
  assert.deepEqual(shifted.labels, grid.labels);
  assert.deepEqual(tensors.get("scalar")!.shape, []);
  assert.deepEqual(tensors.get("scalar")!.values, [-1]);
});

test("addition rejects incompatible shapes, missing inputs, overflow, and oversized broadcast results", () => {
  assert.throws(
    () =>
      evaluateTensors([
        {
          name: "a",
          values: [
            [1, 2, 3],
            [4, 5, 6],
          ],
        },
        { name: "b", values: [1, 2] },
        { name: "result", op: "add", inputs: ["a", "b"] },
      ]),
    /broadcast-compatible/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        { name: "a", values: [1, 2] },
        { name: "result", op: "add", inputs: ["a"] },
      ]),
    /two inputs/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        { name: "a", values: 1e308 },
        { name: "result", op: "add", inputs: ["a", "a"] },
      ]),
    /non-finite/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        {
          name: "a",
          values: Array.from({ length: 64 }, () => [Array(64).fill(1)]),
        },
        { name: "b", values: [Array.from({ length: 64 }, () => [1])] },
        { name: "result", op: "add", inputs: ["a", "b"] },
      ]),
    /65,536/,
  );
});

test("adding to a transpose preserves the constraints of subsequent views", () => {
  const definitions = [
    {
      name: "a",
      values: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    },
    { name: "at", op: "transpose" as const, inputs: ["a"] },
    { name: "bias", values: 1 },
    { name: "sum", op: "add" as const, inputs: ["at", "bias"] },
  ];
  const sum = evaluateTensors(definitions).get("sum")!;
  assert.deepEqual(sum.strides, [1, 3]);
  assert.deepEqual(sum.values, [2, 5, 3, 6, 4, 7]);
  assert.throws(
    () =>
      evaluateTensors([
        ...definitions,
        { name: "flat", op: "view", inputs: ["sum"], shape: [6] },
      ]),
    /strides/,
  );
  const flat = evaluateTensors([
    ...definitions,
    { name: "dense", op: "contiguous", inputs: ["sum"] },
    { name: "flat", op: "view", inputs: ["dense"], shape: [6] },
  ]).get("flat")!;
  assert.deepEqual(flat.values, sum.values);
});

test("invalid graphs, context, splits, and result values fail visibly", () => {
  assert.throws(() => tensorLabels([["a"]], [2]), /Labels/);
  assert.throws(
    () =>
      evaluateTensors([
        { name: "a", values: [[1, 2]] },
        { name: "a", values: [1] },
      ]),
    /unique/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        { name: "a", op: "view", inputs: ["b"], shape: [1] },
        { name: "b", op: "view", inputs: ["a"], shape: [1] },
      ]),
    /cycle/,
  );
  assert.throws(
    () =>
      evaluateTensors([{ name: "a", op: "transpose", inputs: ["missing"] }]),
    /Unknown input/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        { name: "a", values: [1, 2, 3] },
        { name: "b", op: "split", inputs: ["a"], sizes: [2, 2] },
      ]),
    /covering/,
  );
  assert.throws(
    () =>
      evaluateTensors([
        { name: "a", values: [[1e308]] },
        { name: "b", op: "matmul", inputs: ["a", "a"] },
      ]),
    /non-finite/,
  );
});

test("reproduction code follows dependencies even when declarations are out of order", () => {
  const tensors = evaluateTensors([
    { name: "at", op: "transpose", inputs: ["a"] },
    {
      name: "a",
      values: [
        [1, 2],
        [3, 4],
      ],
    },
  ]);
  const code = tensorPython(tensors);
  assert.ok(
    code.indexOf("a = torch.tensor") < code.indexOf("at = a.transpose"),
  );
  assert.match(code, /print\("at", tuple\(at.shape\), at.tolist\(\)\)/);
});
