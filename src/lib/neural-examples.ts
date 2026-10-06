/** Small, deterministic examples for educational figures. No model runtime. */
export type Vector2 = [number, number];
export type Sample = [number, number];

export function vector2(value: unknown): Vector2 {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 10,
    )
  )
    throw new Error(
      "Use a vector with two finite coordinates between −10 and 10.",
    );
  return [value[0], value[1]];
}
export const dot = (a: Vector2, b: Vector2) => a[0] * b[0] + a[1] * b[1];
export function attention2(query: Vector2, keys: Vector2[], values: Vector2[]) {
  if (!keys.length || keys.length !== values.length)
    throw new Error("Provide one value vector per key.");
  const scores = keys.map((key) => dot(query, key) / Math.sqrt(2));
  const maximum = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maximum));
  const total = exps.reduce((a, b) => a + b, 0);
  const weights = exps.map((value) => value / total);
  const output: Vector2 = [0, 0];
  weights.forEach((weight, i) => {
    output[0] += weight * values[i][0];
    output[1] += weight * values[i][1];
  });
  return { scores, weights, output };
}

export function embeddingExample(
  vocabulary: unknown,
  ids: unknown,
  embeddings: unknown,
) {
  if (
    !Array.isArray(vocabulary) ||
    !vocabulary.length ||
    vocabulary.length > 12 ||
    vocabulary.some(
      (token) =>
        typeof token !== "string" || !token.length || token.length > 32,
    )
  )
    throw new Error(
      "Provide 1–12 vocabulary entries, each containing 1–32 characters.",
    );
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 24 ||
    ids.some((id) => !Number.isInteger(id) || id < 0 || id >= vocabulary.length)
  )
    throw new Error(
      "Token IDs must index the vocabulary; use at most 24 tokens.",
    );
  if (!Array.isArray(embeddings) || embeddings.length !== vocabulary.length)
    throw new Error("Provide one embedding row per vocabulary entry.");
  const width = embeddings[0]?.length;
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    width > 16 ||
    embeddings.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== width ||
        row.some(
          (n) =>
            typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 100,
        ),
    )
  )
    throw new Error(
      "Embedding rows must have 1–16 finite features between −100 and 100, with the same width.",
    );
  return {
    vocabulary: vocabulary as string[],
    ids: ids as number[],
    embeddings: embeddings as number[][],
    width,
  };
}

export function sgdSamples(value: unknown): Sample[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 12)
    throw new Error("Provide 2–12 training examples [x, y].");
  return value.map((sample) => {
    if (
      !Array.isArray(sample) ||
      sample.length !== 2 ||
      sample.some((n) => typeof n !== "number" || !Number.isFinite(n)) ||
      Math.abs(sample[0]) < 0.25 ||
      Math.abs(sample[0]) > 10 ||
      Math.abs(sample[1]) > 20
    )
      throw new Error(
        "Use finite [x, y] pairs with 0.25 ≤ |x| ≤ 10 and |y| ≤ 20.",
      );
    return [sample[0], sample[1]];
  });
}
export const sampleLoss = (weight: number, [x, y]: Sample) =>
  0.5 * (weight * x - y) ** 2;
export const sampleGradient = (weight: number, [x, y]: Sample) =>
  x * (weight * x - y);
export const meanLoss = (weight: number, samples: Sample[]) =>
  samples.reduce((sum, sample) => sum + sampleLoss(weight, sample), 0) /
  samples.length;
export function sgdStep(weight: number, sample: Sample, rate: number) {
  if (!Number.isFinite(weight) || !Number.isFinite(rate) || rate <= 0)
    throw new Error(
      "The weight must be finite and the learning rate positive.",
    );
  const gradient = sampleGradient(weight, sample);
  return { before: weight, gradient, after: weight - rate * gradient };
}
/** Reproducible sampling with replacement. Resetting a figure repeats its run. */
export function sampleIndex(seed: number, count: number) {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { seed: next, index: Math.floor((next / 4294967296) * count) };
}

export interface ModelStage {
  label: string;
  shape: string;
  note: string;
  href?: string;
}
export function modelStages(value: unknown): ModelStage[] {
  if (!Array.isArray(value) || !value.length || value.length > 8)
    throw new Error("Provide 1–8 model stages.");
  return value.map((stage) => {
    if (
      !stage ||
      typeof stage !== "object" ||
      ["label", "shape", "note"].some(
        (key) =>
          typeof stage[key] !== "string" ||
          !stage[key].trim() ||
          stage[key].length > 500,
      ) ||
      (stage.href !== undefined && typeof stage.href !== "string")
    )
      throw new Error("Each stage needs a label, shape, and short note.");
    return {
      label: stage.label,
      shape: stage.shape,
      note: stage.note,
      href: stage.href,
    };
  });
}
export function gptStages(layers: number): ModelStage[] {
  if (!Number.isInteger(layers) || layers < 1 || layers > 96)
    throw new Error("Use 1–96 transformer blocks.");
  return [
    {
      label: "Token IDs",
      shape: "$B\\times T$",
      note: "Each integer selects a vocabulary entry. B is the batch size; T is the sequence length.",
    },
    {
      label: "Embeddings",
      shape: "$B\\times T\\times C$",
      note: "Look up token and learned position vectors, then add them. C is the number of features per token.",
    },
    {
      label: `Block × ${layers}`,
      shape: "$B\\times T\\times C$",
      note: `Apply ${layers} transformer ${layers === 1 ? "block" : "blocks"} in sequence. Each has its own parameters and preserves the tensor shape.`,
    },
    {
      label: "Final norm",
      shape: "$B\\times T\\times C$",
      note: "Normalize across the C features of each token, with learned scale and bias.",
    },
    {
      label: "Vocabulary",
      shape: "$B\\times T\\times V$",
      note: "Project each token to V vocabulary scores (logits). GPT-2 reuses the token embedding weights here. Sampling uses the last position.",
    },
  ];
}
