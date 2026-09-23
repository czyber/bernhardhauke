export type TensorPalette = "binary" | "sequential" | "diverging";

export interface PixelTensor {
  name: string;
  shape: number[];
  values: number[];
  axes: string[];
  palette: TensorPalette;
  caption: string;
}

/** Rectangular, row-major data. Keep article figures small enough to inspect. */
export function tensorFromNested(
  input: unknown,
): Pick<PixelTensor, "shape" | "values"> {
  let count = 0;
  function visit(
    value: unknown,
    depth: number,
  ): { shape: number[]; values: number[] } {
    if (typeof value === "number" && Number.isFinite(value)) {
      if (++count > 65_536)
        throw new Error("A tensor figure supports at most 65,536 values.");
      return { shape: [], values: [value] };
    }
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.length > 64 ||
      depth >= 6
    ) {
      throw new Error(
        "Use a number or a rectangular array with 1–64 entries per axis and at most 6 axes.",
      );
    }
    const children = value.map((child) => visit(child, depth + 1));
    const shape = children[0].shape;
    if (children.some((child) => child.shape.join(",") !== shape.join(","))) {
      throw new Error("Every row and slice must have the same shape.");
    }
    return {
      shape: [value.length, ...shape],
      values: children.flatMap((child) => child.values),
    };
  }
  return visit(input, 0);
}

export function tensorOffset(shape: number[], indices: number[]): number {
  if (indices.length !== shape.length)
    throw new Error("An index is required for every axis.");
  return shape.reduce((offset, size, axis) => {
    const index = indices[axis];
    if (!Number.isInteger(index) || index < 0 || index >= size)
      throw new Error("Tensor index is out of bounds.");
    return offset * size + index;
  }, 0);
}

export function tensorSlice(
  tensor: Pick<PixelTensor, "shape" | "values">,
  prefix: number[],
) {
  const { shape, values } = tensor;
  if (prefix.length !== Math.max(0, shape.length - 2))
    throw new Error("Select every axis preceding the displayed matrix.");
  const rows = shape.length > 1 ? shape.at(-2)! : 1;
  const columns = shape.at(-1) ?? 1;
  const indices = [...prefix, ...Array(Math.min(2, shape.length)).fill(0)];
  const offset = tensorOffset(shape, indices);
  return {
    rows,
    columns,
    values: values.slice(offset, offset + rows * columns),
  };
}

export function tensorDomain(
  tensor: Pick<PixelTensor, "values" | "palette">,
): [number, number] {
  if (tensor.palette === "binary") return [0, 1];
  let low = 0;
  let high = 0;
  for (const value of tensor.values) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (tensor.palette === "diverging") {
    const extent = Math.max(-low, high) || 1;
    return [-extent, extent];
  }
  return [low, high || (low === 0 ? 1 : 0)];
}

export function formatTensorValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return Math.abs(value) >= 0.001 && Math.abs(value) < 10_000
    ? String(Number(value.toFixed(4)))
    : value.toExponential(3);
}
