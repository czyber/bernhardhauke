import { tensorFromNested, tensorOffset, tensorLabels } from "./tensor.ts";
import type { PixelTensor } from "./tensor.ts";

export type TensorOperation =
  | "view"
  | "reshape"
  | "transpose"
  | "split"
  | "add"
  | "matmul"
  | "kron"
  | "contiguous";
export interface TensorDefinition {
  name: string;
  values?: unknown;
  op?: TensorOperation;
  inputs?: string[];
  shape?: number[];
  dims?: number[];
  sizes?: number[];
  axis?: number;
  part?: number;
  axes?: string[];
  labels?: unknown;
  caption?: string;
}
export interface TensorReference {
  name: string;
  index: number;
}
export interface EvaluatedTensor extends PixelTensor {
  strides: number[];
  definition: TensorDefinition;
  sources: (index: number) => TensorReference[];
}

const sizeOf = (shape: number[]) => shape.reduce((a, b) => a * b, 1);
export function tensorIndices(shape: number[], index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= sizeOf(shape))
    throw new Error("Tensor index is out of bounds.");
  const indices = shape.map(() => 0);
  for (let axis = shape.length - 1; axis >= 0; axis--) {
    indices[axis] = index % shape[axis];
    index = Math.floor(index / shape[axis]);
  }
  return indices;
}
function contiguousStrides(shape: number[]) {
  let stride = 1;
  return shape
    .map((_, axis) => axis)
    .reverse()
    .map((axis) => {
      const result = stride;
      stride *= shape[axis];
      return result;
    })
    .reverse();
}

// Element-wise results are dense but can retain a transposed input's axis
// order. Track that order so a later .view has the same constraints as PyTorch.
function additionStrides(inputs: EvaluatedTensor[], shape: number[]) {
  const layouts = inputs.map((input) =>
    shape.map((size, axis) => {
      const i = axis + input.shape.length - shape.length;
      return i < 0 || (input.shape[i] === 1 && size !== 1)
        ? 0
        : input.strides[i];
    }),
  );
  const order = shape.map((_, axis) => axis).reverse();
  const compare = (left: number, right: number) => {
    for (const layout of layouts) {
      if (!layout[left] || !layout[right]) continue;
      if (layout[left] !== layout[right]) return layout[left] - layout[right];
      if (shape[left] > shape[right]) return 1;
    }
    return 0;
  };
  // Keep ambiguous axes in row-major order, considering operands left first.
  for (let i = 1; i < order.length; i++) {
    let moving = i;
    for (let j = i - 1; j >= 0; j--) {
      const comparison = compare(order[j], order[moving]);
      if (comparison < 0) break;
      if (comparison > 0) {
        [order[j], order[moving]] = [order[moving], order[j]];
        moving = j;
      }
    }
  }
  const strides = shape.map(() => 0);
  let stride = 1;
  for (const axis of order) {
    strides[axis] = stride;
    stride *= shape[axis];
  }
  return strides;
}
function validateShape(shape: number[]) {
  if (
    shape.length > 6 ||
    shape.some((n) => !Number.isInteger(n) || n < 1 || n > 64) ||
    sizeOf(shape) > 65_536
  )
    throw new Error(
      "Use at most 6 axes, 1–64 entries per axis, and 65,536 values.",
    );
  return shape;
}
function dimension(axis: number, rank: number) {
  const result = axis < 0 ? axis + rank : axis;
  if (!Number.isInteger(result) || result < 0 || result >= rank)
    throw new Error("Operation axis is out of bounds.");
  return result;
}
function reshapeDimensions(requested: number[] | undefined, count: number) {
  if (!requested) throw new Error("A view or reshape needs a shape.");
  const shape = [...requested];
  if (shape.filter((n) => n === -1).length > 1)
    throw new Error("Only one inferred (-1) dimension is allowed.");
  const inferred = shape.indexOf(-1);
  if (inferred !== -1)
    shape[inferred] = count / sizeOf(shape.filter((n) => n !== -1));
  validateShape(shape);
  if (sizeOf(shape) !== count)
    throw new Error("A view or reshape must preserve the number of elements.");
  return shape;
}

// For these small explanatory tensors, verify the storage address of every
// element. A view is valid only if the new axes can express the same addresses
// with fixed strides, including non-contiguous splits and singleton axes.
function viewStrides(
  source: EvaluatedTensor,
  shape: number[],
): number[] | null {
  const storage = (index: number) =>
    tensorIndices(source.shape, index).reduce(
      (sum, n, axis) => sum + n * source.strides[axis],
      0,
    );
  const logicalStrides = contiguousStrides(shape);
  const strides = shape.map((size, axis) =>
    size === 1 ? logicalStrides[axis] : storage(logicalStrides[axis]),
  );
  for (let index = 0; index < source.values.length; index++) {
    const address = tensorIndices(shape, index).reduce(
      (sum, n, axis) => sum + n * strides[axis],
      0,
    );
    if (address !== storage(index)) return null;
  }
  return strides;
}

export function evaluateTensors(definitions: TensorDefinition[]) {
  if (!definitions.length || definitions.length > 24)
    throw new Error("An equation needs between 1 and 24 tensors.");
  const definitionsByName = new Map<string, TensorDefinition>();
  for (const definition of definitions) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(definition.name) ||
      definitionsByName.has(definition.name)
    )
      throw new Error(
        "Tensor names must be unique identifiers within an equation.",
      );
    definitionsByName.set(definition.name, definition);
  }
  const resolved = new Map<string, EvaluatedTensor>();
  const visiting = new Set<string>();
  let total = 0;
  function resolve(name: string): EvaluatedTensor {
    const existing = resolved.get(name);
    if (existing) return existing;
    const definition = definitionsByName.get(name);
    if (!definition) throw new Error(`Unknown input tensor: ${name}`);
    if (visiting.has(name))
      throw new Error("Tensor operations cannot contain a dependency cycle.");
    visiting.add(name);
    const { op } = definition;
    let shape: number[],
      values: number[],
      strides: number[],
      axes: string[] | undefined;
    let labels: PixelTensor["labels"];
    let sources: EvaluatedTensor["sources"] = () => [];
    if (!op) {
      if (definition.inputs?.length)
        throw new Error("Specify an operation for a tensor with inputs.");
      ({ shape, values } = tensorFromNested(definition.values));
      strides = contiguousStrides(shape);
    } else {
      if (definition.values !== undefined)
        throw new Error(
          "Computed tensors take inputs, not hand-written result values.",
        );
      const binary = op === "add" || op === "matmul" || op === "kron";
      if (definition.inputs?.length !== (binary ? 2 : 1))
        throw new Error(`${op} needs ${binary ? "two inputs" : "one input"}.`);
      const inputs = definition.inputs.map(resolve);
      const [a, b] = inputs;
      const ref = (input: EvaluatedTensor, index: number) => ({
        name: input.name,
        index,
      });
      if (op === "view" || op === "reshape") {
        shape = reshapeDimensions(definition.shape, a.values.length);
        const compatible = viewStrides(a, shape);
        if (!compatible && op === "view")
          throw new Error(
            `${name}: .view cannot preserve this tensor's strides. Use a contiguous operation first, or reshape.`,
          );
        strides = compatible ?? contiguousStrides(shape);
        values = [...a.values];
        if (shape.join() === a.shape.join()) {
          axes = a.axes;
          labels = a.labels;
        }
        sources = (index) => [ref(a, index)];
      } else if (op === "transpose") {
        const dims = definition.dims ?? [-2, -1];
        if (dims.length !== 2)
          throw new Error("Transpose needs two dimensions.");
        const [first, second] = dims.map((axis) =>
          dimension(axis, a.shape.length),
        );
        const swap = <T>(list: T[]) => {
          const result = [...list];
          [result[first], result[second]] = [result[second], result[first]];
          return result;
        };
        shape = swap(a.shape);
        strides = swap(a.strides);
        axes = swap(a.axes);
        labels = a.labels ? swap(a.labels) : undefined;
        sources = (index) => [
          ref(a, tensorOffset(a.shape, swap(tensorIndices(shape, index)))),
        ];
        values = a.values.map((_, index) => a.values[sources(index)[0].index]);
      } else if (op === "split") {
        const axis = dimension(definition.axis ?? -1, a.shape.length);
        const sizes = definition.sizes;
        const part = definition.part ?? 0;
        if (
          !sizes?.length ||
          sizes.some((n) => !Number.isInteger(n) || n <= 0) ||
          sizes.reduce((sum, n) => sum + n, 0) !== a.shape[axis]
        )
          throw new Error(
            "Split sizes must be positive integers covering the selected axis exactly.",
          );
        if (!Number.isInteger(part) || part < 0 || part >= sizes.length)
          throw new Error("Split part is out of bounds.");
        const start = sizes.slice(0, part).reduce((sum, n) => sum + n, 0);
        shape = [...a.shape];
        shape[axis] = sizes[part];
        strides = [...a.strides];
        axes = [...a.axes];
        labels = a.labels?.map((names, i) =>
          i === axis
            ? (names?.slice(start, start + sizes[part]) ?? null)
            : names,
        );
        sources = (index) => {
          const indices = tensorIndices(shape, index);
          indices[axis] += start;
          return [ref(a, tensorOffset(a.shape, indices))];
        };
        values = Array.from(
          { length: sizeOf(shape) },
          (_, index) => a.values[sources(index)[0].index],
        );
      } else if (op === "add") {
        const rank = Math.max(a.shape.length, b.shape.length);
        const aligned = (input: EvaluatedTensor, axis: number) =>
          axis - rank + input.shape.length;
        shape = validateShape(
          Array.from({ length: rank }, (_, axis) => {
            const left = a.shape[aligned(a, axis)] ?? 1;
            const right = b.shape[aligned(b, axis)] ?? 1;
            if (left !== right && left !== 1 && right !== 1)
              throw new Error(
                `Addition needs broadcast-compatible shapes; got [${a.shape}] and [${b.shape}]. Align axes from the right: sizes must match or one must be 1.`,
              );
            return Math.max(left, right);
          }),
        );
        strides = additionStrides(inputs, shape);
        // Keep context from an operand that supplies the full result axis,
        // rather than repeating a singleton label across unrelated entries.
        const context = shape.map((size, axis) =>
          inputs
            .map((input) => ({ input, axis: aligned(input, axis) }))
            .filter(({ input, axis }) => input.shape[axis] === size),
        );
        axes = context.map(([{ input, axis }]) => input.axes[axis]);
        labels = context.map(
          (candidates) =>
            candidates
              .map(({ input, axis }) => input.labels?.[axis])
              .find((names) => names != null) ?? null,
        );
        sources = (index) => {
          const indices = tensorIndices(shape, index);
          return inputs.map((input) =>
            ref(
              input,
              tensorOffset(
                input.shape,
                input.shape.map((size, axis) =>
                  size === 1 ? 0 : indices[rank - input.shape.length + axis],
                ),
              ),
            ),
          );
        };
        values = Array.from({ length: sizeOf(shape) }, (_, index) => {
          const [left, right] = sources(index);
          return a.values[left.index] + b.values[right.index];
        });
      } else if (op === "matmul" || op === "kron") {
        if (a.shape.length !== 2 || b.shape.length !== 2)
          throw new Error(`${op} currently takes two matrices (rank 2).`);
        const [m, k] = a.shape;
        const [p, n] = b.shape;
        if (op === "matmul" && k !== p)
          throw new Error(
            `Matrix multiplication needs matching inner dimensions; got ${k} and ${p}.`,
          );
        shape = validateShape(op === "matmul" ? [m, n] : [m * p, k * n]);
        strides = contiguousStrides(shape);
        if (op === "matmul") {
          axes = [a.axes[0], b.axes[1]];
          labels = [a.labels?.[0] ?? null, b.labels?.[1] ?? null];
        }
        sources = (index) => {
          const [row, col] = tensorIndices(shape, index);
          return op === "matmul"
            ? Array.from({ length: k }, (_, inner) => [
                ref(a, row * k + inner),
                ref(b, inner * n + col),
              ]).flat()
            : [
                ref(a, Math.floor(row / p) * k + Math.floor(col / n)),
                ref(b, (row % p) * n + (col % n)),
              ];
        };
        values = Array.from({ length: sizeOf(shape) }, (_, index) => {
          const refs = sources(index);
          let sum = 0;
          for (let i = 0; i < refs.length; i += 2)
            sum += a.values[refs[i].index] * b.values[refs[i + 1].index];
          return sum;
        });
      } else if (op === "contiguous") {
        shape = [...a.shape];
        strides = contiguousStrides(shape);
        values = [...a.values];
        axes = a.axes;
        labels = a.labels;
        sources = (index) => [ref(a, index)];
      } else throw new Error(`Unknown tensor operation: ${op}`);
    }
    if (values.some((n) => !Number.isFinite(n)))
      throw new Error("The operation produced a non-finite value.");
    total += values.length;
    if (total > 65_536)
      throw new Error(
        "Keep an equation under 65,536 values across its tensors.",
      );
    axes = definition.axes ?? axes ?? shape.map((_, i) => `axis ${i}`);
    if (axes.length !== shape.length || axes.some((axis) => !axis.trim()))
      throw new Error("Provide one non-empty axis name per dimension.");
    labels = tensorLabels(definition.labels ?? labels, shape);
    const result: EvaluatedTensor = {
      name,
      shape,
      values,
      strides,
      axes,
      labels,
      caption: definition.caption ?? "",
      palette: values.some((n) => n < 0) ? "diverging" : "sequential",
      definition,
      sources,
    };
    resolved.set(name, result);
    visiting.delete(name);
    return result;
  }
  definitions.forEach((definition) => resolve(definition.name));
  return resolved;
}

export function tensorPython(tensors: Map<string, EvaluatedTensor>) {
  const lines = ["import torch", ""];
  for (const [name, tensor] of tensors) {
    const d = tensor.definition,
      [a, b] = d.inputs ?? [];
    const args = (numbers: number[]) => numbers.join(", ");
    const expression = !d.op
      ? `torch.tensor(${JSON.stringify(d.values)}, dtype=torch.float64)`
      : d.op === "view" || d.op === "reshape"
        ? `${a}.${d.op}(${d.shape!.length ? args(d.shape!) : "[]"})`
        : d.op === "transpose"
          ? `${a}.transpose(${args(d.dims ?? [-2, -1])})`
          : d.op === "split"
            ? `${a}.split([${args(d.sizes!)}], dim=${d.axis ?? -1})[${d.part ?? 0}]`
            : d.op === "matmul"
              ? `${a} @ ${b}`
              : d.op === "add"
                ? `${a} + ${b}`
                : d.op === "kron"
                  ? `torch.kron(${a}, ${b})`
                  : `${a}.contiguous()`;
    lines.push(`${name} = ${expression}`);
  }
  lines.push(
    "",
    ...[...tensors.keys()].map(
      (name) => `print("${name}", tuple(${name}.shape), ${name}.tolist())`,
    ),
  );
  return lines.join("\n");
}
