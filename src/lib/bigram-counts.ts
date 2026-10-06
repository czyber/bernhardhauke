export interface BigramCounts {
  characters: string[];
  counts: number[][];
  totals: number[];
  probabilities: number[][];
  boundary: string;
}

/** Count adjacent characters independently in each boundary-marked name. */
export function countNameBigrams(
  names: readonly string[],
  boundary = ".",
): BigramCounts {
  if (
    !names.length ||
    [...boundary].length !== 1 ||
    names.some((name) => !name.length || name.includes(boundary))
  )
    throw new Error(
      "Use nonempty names without the single boundary character.",
    );
  const characters = [
    boundary,
    ...[...new Set(names.flatMap((name) => [...name]))].sort(),
  ];
  const indices = new Map(
    characters.map((character, index) => [character, index]),
  );
  const counts = characters.map(() => characters.map(() => 0));
  for (const name of names) {
    const sequence = [boundary, ...name, boundary];
    for (let position = 0; position < sequence.length - 1; position++) {
      counts[indices.get(sequence[position])!][
        indices.get(sequence[position + 1])!
      ]++;
    }
  }
  const totals = counts.map((row) =>
    row.reduce((sum, count) => sum + count, 0),
  );
  const probabilities = counts.map((row, index) =>
    row.map((count) => count / totals[index]),
  );
  return { characters, counts, totals, probabilities, boundary };
}

/** Map a uniform draw in [0, 1) to a next character using its row counts. */
export function drawNextCharacter(
  model: BigramCounts,
  current: string,
  draw: number,
) {
  const index = model.characters.indexOf(current);
  if (index < 0) throw new Error("The current character needs a count row.");
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1)
    throw new Error("Use a random draw from zero up to, but excluding, one.");
  let remaining = draw * model.totals[index];
  for (let next = 0; next < model.characters.length; next++) {
    const count = model.counts[index][next];
    if (remaining < count) return model.characters[next];
    remaining -= count;
  }
  throw new Error("The current row needs a positive count total.");
}
