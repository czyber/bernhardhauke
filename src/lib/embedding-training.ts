export type EmbeddingPoint = [number, number];

export const embeddingNextTokens = [
  "eats",
  "sleeps",
  "runs",
  "moves",
  "stops",
  "arrives",
];

/** Each count is an observed two-token example; no similarity labels are used. */
export const embeddingToyCorpus = [
  { word: "cat", counts: [8, 6, 2, 0, 0, 0] },
  { word: "dog", counts: [6, 4, 6, 0, 0, 0] },
  { word: "rabbit", counts: [9, 5, 2, 0, 0, 0] },
  { word: "car", counts: [0, 0, 0, 9, 3, 4] },
  { word: "bus", counts: [0, 0, 0, 8, 5, 3] },
  { word: "train", counts: [0, 0, 0, 7, 4, 5] },
];

export interface EmbeddingParameters {
  embeddings: EmbeddingPoint[];
  readout: EmbeddingPoint[];
  bias: number[];
}

export interface EmbeddingSnapshot {
  step: number;
  embeddings: EmbeddingPoint[];
  probabilities: number[][];
  loss: number;
}

export function initialEmbeddingParameters(seed = 17): EmbeddingParameters {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const vector = (scale: number): EmbeddingPoint => [
    (random() - 0.5) * scale,
    (random() - 0.5) * scale,
  ];
  return {
    embeddings: embeddingToyCorpus.map(() => vector(0.8)),
    readout: embeddingNextTokens.map(() => vector(1)),
    bias: embeddingNextTokens.map(() => 0),
  };
}

/** Mean next-token cross-entropy, differentiated through embeddings and readout. */
export function evaluateEmbeddingTraining(parameters: EmbeddingParameters) {
  const gradient: EmbeddingParameters = {
    embeddings: embeddingToyCorpus.map(() => [0, 0]),
    readout: embeddingNextTokens.map(() => [0, 0]),
    bias: embeddingNextTokens.map(() => 0),
  };
  const exampleCount = embeddingToyCorpus.reduce(
    (sum, row) => sum + row.counts.reduce((total, count) => total + count, 0),
    0,
  );
  let loss = 0;
  const probabilities = embeddingToyCorpus.map((row, input) => {
    const embedding = parameters.embeddings[input];
    const scores = parameters.readout.map(
      (weights, output) =>
        embedding[0] * weights[0] +
        embedding[1] * weights[1] +
        parameters.bias[output],
    );
    const maximum = Math.max(...scores);
    const exp = scores.map((score) => Math.exp(score - maximum));
    const expTotal = exp.reduce((sum, value) => sum + value, 0);
    const weights = exp.map((value) => value / expTotal);
    const rowTotal = row.counts.reduce((sum, count) => sum + count, 0);
    const logNormalizer = maximum + Math.log(expTotal);
    row.counts.forEach((count, output) => {
      loss += (count * (logNormalizer - scores[output])) / exampleCount;
      const error = (rowTotal * weights[output] - count) / exampleCount;
      gradient.bias[output] += error;
      for (const axis of [0, 1]) {
        gradient.embeddings[input][axis] +=
          error * parameters.readout[output][axis];
        gradient.readout[output][axis] += error * embedding[axis];
      }
    });
    return weights;
  });
  return { loss, probabilities, gradient };
}

export function stepEmbeddingTraining(
  parameters: EmbeddingParameters,
  learningRate = 0.5,
): EmbeddingParameters {
  const { gradient } = evaluateEmbeddingTraining(parameters);
  return {
    embeddings: parameters.embeddings.map((point, input) => [
      point[0] - learningRate * gradient.embeddings[input][0],
      point[1] - learningRate * gradient.embeddings[input][1],
    ]),
    readout: parameters.readout.map((point, output) => [
      point[0] - learningRate * gradient.readout[output][0],
      point[1] - learningRate * gradient.readout[output][1],
    ]),
    bias: parameters.bias.map(
      (value, output) => value - learningRate * gradient.bias[output],
    ),
  };
}

export function embeddingTrainingHistory(steps = 600, seed = 17) {
  let parameters = initialEmbeddingParameters(seed);
  const history: EmbeddingSnapshot[] = [];
  for (let step = 0; step <= steps; step++) {
    const { loss, probabilities } = evaluateEmbeddingTraining(parameters);
    history.push({
      step,
      embeddings: parameters.embeddings.map((point) => [...point]),
      probabilities,
      loss,
    });
    if (step < steps) parameters = stepEmbeddingTraining(parameters);
  }
  return history;
}
