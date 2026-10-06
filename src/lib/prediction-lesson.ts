/** One adjustable logit, two fixed zero logits, and the first token as target. */
export function predictionExample(score: number) {
  if (!Number.isFinite(score)) throw new Error("Use a finite score.");
  const max = Math.max(score, 0);
  const exps = [Math.exp(score - max), Math.exp(-max), Math.exp(-max)];
  const total = exps.reduce((a, b) => a + b, 0);
  const probabilities = exps.map((x) => x / total);
  return {
    probabilities,
    loss: max + Math.log(total) - score,
    gradient: probabilities[0] - 1,
  };
}
