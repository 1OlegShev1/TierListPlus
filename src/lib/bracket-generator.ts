function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function generateBracket(itemIds: string[]) {
  const shuffled = [...itemIds].sort(() => Math.random() - 0.5);
  const bracketSize = nextPowerOf2(shuffled.length);
  const rounds = Math.log2(bracketSize);
  const matchups: {
    round: number;
    position: number;
    itemAId: string | null;
    itemBId: string | null;
  }[] = [];

  // First round
  const firstRoundMatchups = bracketSize / 2;
  for (let i = 0; i < firstRoundMatchups; i++) {
    const itemA = shuffled[i * 2] ?? null;
    const itemB = shuffled[i * 2 + 1] ?? null;
    matchups.push({ round: 1, position: i, itemAId: itemA, itemBId: itemB });
  }

  // Subsequent rounds (empty, filled as winners advance)
  for (let round = 2; round <= rounds; round++) {
    const roundMatchups = bracketSize / Math.pow(2, round);
    for (let i = 0; i < roundMatchups; i++) {
      matchups.push({ round, position: i, itemAId: null, itemBId: null });
    }
  }

  return { rounds, matchups };
}
