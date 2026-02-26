const WORDS = [
  "TIGER",
  "MAPLE",
  "RIVER",
  "CLOUD",
  "FLAME",
  "STONE",
  "BRAVE",
  "EAGLE",
  "FROST",
  "OCEAN",
  "SWIFT",
  "CORAL",
  "AMBER",
  "STORM",
  "CEDAR",
  "PEARL",
  "SOLAR",
  "LUNAR",
  "NOBLE",
  "BLAZE",
  "DRIFT",
  "GROVE",
  "SPARK",
  "DELTA",
  "CREST",
  "HAVEN",
  "PIXEL",
  "VAULT",
  "PRISM",
  "FORGE",
  "BLOOM",
  "RIDGE",
  "COMET",
  "FLINT",
  "PULSE",
  "OASIS",
  "THORN",
  "ORBIT",
  "EMBER",
  "DUNE",
  "ATLAS",
  "CRANE",
  "RAVEN",
  "LOTUS",
  "STEEL",
  "BIRCH",
  "QUILL",
  "REIGN",
];

/** Generate a recovery code like "TIGER-MAPLE-RIVER-42" */
export function generateRecoveryCode(): string {
  const picked: string[] = [];
  const used = new Set<number>();
  while (picked.length < 3) {
    const idx = Math.floor(Math.random() * WORDS.length);
    if (!used.has(idx)) {
      used.add(idx);
      picked.push(WORDS[idx]);
    }
  }
  const num = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${picked.join("-")}-${num}`;
}
