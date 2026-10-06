import { attention2, dot, vector2 } from "./neural-examples.ts";
import type { Vector2 } from "./neural-examples.ts";

export interface FieldSample {
  loss: number;
  gradient: Vector2;
  weights: number[];
  output?: Vector2;
}

/** One embedding row, a fixed vocabulary readout, and next-token cross-entropy. */
export function embeddingGradient(
  embedding: Vector2,
  readout: Vector2[],
  target: number,
): FieldSample {
  const scores = readout.map((weight) => dot(embedding, weight));
  const maximum = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maximum));
  const total = exps.reduce((sum, value) => sum + value, 0);
  const weights = exps.map((value) => value / total);
  const gradient: Vector2 = [0, 0];
  weights.forEach((probability, i) => {
    const error = probability - Number(i === target);
    gradient[0] += error * readout[i][0];
    gradient[1] += error * readout[i][1];
  });
  return {
    loss: maximum - scores[target] + Math.log(total),
    gradient,
    weights,
  };
}

/** Differentiate output error through values, softmax, and query–key scores. */
export function attentionGradient(
  query: Vector2,
  keys: Vector2[],
  values: Vector2[],
  target: Vector2,
): FieldSample {
  const { weights, output } = attention2(query, keys, values);
  const error: Vector2 = [output[0] - target[0], output[1] - target[1]];
  const gradient: Vector2 = [0, 0];
  weights.forEach((weight, i) => {
    const centered: Vector2 = [
      values[i][0] - output[0],
      values[i][1] - output[1],
    ];
    const scoreGradient = weight * dot(error, centered);
    gradient[0] += (scoreGradient * keys[i][0]) / Math.sqrt(2);
    gradient[1] += (scoreGradient * keys[i][1]) / Math.sqrt(2);
  });
  return { loss: 0.5 * dot(error, error), gradient, weights, output };
}

export function fieldStep(
  point: Vector2,
  gradient: Vector2,
  rate: number,
): Vector2 {
  return [point[0] - rate * gradient[0], point[1] - rate * gradient[1]];
}

interface FieldOptions {
  mode?: string | null;
  initial?: unknown;
  vectors?: unknown;
  values?: unknown;
  target?: unknown;
  labels?: unknown;
  extent?: unknown;
  rate?: unknown;
}

export function vectorFieldExample(options: FieldOptions = {}) {
  const mode = options.mode ?? "embedding";
  if (mode !== "embedding" && mode !== "attention")
    throw new Error("Choose embedding or attention mode.");
  const initial = vector2(
    options.initial ?? (mode === "embedding" ? [-0.6, 0.8] : [1, 0]),
  );
  const rawVectors =
    options.vectors ??
    (mode === "embedding"
      ? [
          [0.5, -1],
          [1, 0],
          [0, 1],
        ]
      : [
          [1, 0],
          [0, 1],
        ]);
  if (
    !Array.isArray(rawVectors) ||
    rawVectors.length < 2 ||
    rawVectors.length > 4
  )
    throw new Error("Provide 2–4 readout vectors or keys.");
  const vectors = rawVectors.map(vector2);
  const extent = Number(options.extent ?? 3);
  const rate = Number(options.rate ?? 0.2);
  if (!Number.isFinite(extent) || extent < 0.5 || extent > 10)
    throw new Error("The fixed axis extent must be between 0.5 and 10.");
  if (initial.some((coordinate) => Math.abs(coordinate) > extent))
    throw new Error("The initial vector must fit inside the fixed axes.");
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1)
    throw new Error("Use a learning rate above zero and at most one.");
  const defaultLabels =
    mode === "embedding" && vectors.length === 3
      ? ["blue", "red", "green"]
      : vectors.map(
          (_, i) => `${mode === "embedding" ? "token" : "position"} ${i + 1}`,
        );
  const labels = options.labels ?? defaultLabels;
  if (
    !Array.isArray(labels) ||
    labels.length !== vectors.length ||
    labels.some(
      (label) =>
        typeof label !== "string" || !label.trim() || label.length > 32,
    )
  )
    throw new Error("Provide one label of 1–32 characters per vector.");
  if (mode === "embedding") {
    const target = options.target ?? 0;
    if (
      typeof target !== "number" ||
      !Number.isInteger(target) ||
      target < 0 ||
      target >= vectors.length
    )
      throw new Error("The target must be a valid readout index.");
    return {
      mode: "embedding" as const,
      initial,
      extent,
      rate,
      labels: labels as string[],
      vectors,
      target,
      evaluate: (point: Vector2) => embeddingGradient(point, vectors, target),
    };
  }
  const rawValues = options.values ?? [
    [2, 0],
    [0, 4],
  ];
  if (!Array.isArray(rawValues) || rawValues.length !== vectors.length)
    throw new Error("Provide one value vector per key.");
  const values = rawValues.map(vector2);
  const target = vector2(options.target ?? [0, 4]);
  return {
    mode: "attention" as const,
    initial,
    extent,
    rate,
    labels: labels as string[],
    vectors,
    values,
    target,
    evaluate: (point: Vector2) =>
      attentionGradient(point, vectors, values, target),
  };
}
