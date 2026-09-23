import type { PixelTensor } from "../lib/tensor";

// Fixed toy data, independent of the GPT's weights. Attention is actually
// computed from these queries and keys; no trained-model claim is made.
export function tensorExample(preset: string): PixelTensor {
  if (preset === "cube") {
    return {
      name: "cube",
      shape: [4, 4, 4],
      axes: ["layer", "row", "column"],
      palette: "sequential",
      values: Array.from({ length: 64 }, (_, i) => i),
      caption:
        "64 numbers, arranged in 4 layers of 4 × 4. Select a layer to reveal the values inside.",
    };
  }
  if (preset === "causal-mask") {
    return {
      name: "mask",
      shape: [8, 8],
      axes: ["query token", "key token"],
      palette: "binary",
      values: Array.from({ length: 64 }, (_, i) =>
        Number(i % 8 <= Math.floor(i / 8)),
      ),
      caption:
        "1 allows attention; 0 blocks it. Each row can see its own position and every earlier position.",
    };
  }
  if (preset === "embeddings") {
    return {
      name: "x",
      shape: [2, 8, 16],
      axes: ["batch", "token", "feature"],
      palette: "diverging",
      values: Array.from({ length: 256 }, (_, i) =>
        Number(
          (
            Math.sin(i * 0.73 + Math.floor(i / 16)) *
            Math.cos(i * 0.17) *
            1.8
          ).toFixed(3),
        ),
      ),
      caption:
        "Illustrative values: 2 sequences × 8 tokens × 16 features. Every square is one number.",
    };
  }
  if (preset === "attention") {
    const values: number[] = [];
    for (let batch = 0; batch < 2; batch++) {
      for (let head = 0; head < 3; head++) {
        for (let query = 0; query < 8; query++) {
          const scores = Array.from({ length: query + 1 }, (_, key) => {
            let dot = 0;
            for (let feature = 0; feature < 4; feature++) {
              const q = Math.sin(
                (query + 1) * (feature + 1) * 0.7 + head + batch * 0.4,
              );
              const k = Math.cos(
                (key + 1) * (feature + 1) * 0.4 + head * 1.3 + batch,
              );
              dot += q * k;
            }
            return dot / Math.sqrt(4);
          });
          const max = Math.max(...scores);
          const weights = scores.map((score) => Math.exp(score - max));
          const sum = weights.reduce((a, b) => a + b, 0);
          values.push(
            ...weights.map((value) => value / sum),
            ...Array(7 - query).fill(0),
          );
        }
      }
    }
    return {
      name: "attention",
      shape: [2, 3, 8, 8],
      axes: ["batch", "head", "query token", "key token"],
      palette: "sequential",
      values,
      caption:
        "Computed from fixed toy queries and keys using softmax(QKᵀ / √4) with a causal mask. Each row sums to 1.",
    };
  }
  throw new Error(`Unknown tensor preset: ${preset}`);
}
