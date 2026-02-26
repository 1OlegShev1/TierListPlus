export interface TierConfig {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export const DEFAULT_TIER_CONFIG: TierConfig[] = [
  { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
  { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
  { key: "B", label: "B", color: "#ffdf7f", sortOrder: 2 },
  { key: "C", label: "C", color: "#ffff7f", sortOrder: 3 },
  { key: "D", label: "D", color: "#bfff7f", sortOrder: 4 },
  { key: "F", label: "F", color: "#7fffff", sortOrder: 5 },
];

/** Derive unique keys from tier labels. Call before saving tier config. */
export function deriveTierKeys(tiers: TierConfig[]): TierConfig[] {
  const result = tiers.map((t, i) => ({
    ...t,
    key: t.label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || `T${i}`,
    sortOrder: i,
  }));

  const seen = new Set<string>();
  for (const tier of result) {
    let k = tier.key;
    let n = 1;
    while (seen.has(k)) {
      k = `${tier.key}${n++}`;
    }
    tier.key = k;
    seen.add(k);
  }

  return result;
}

export const TIER_COLORS = [
  "#ff7f7f",
  "#ffbf7f",
  "#ffdf7f",
  "#ffff7f",
  "#bfff7f",
  "#7fff7f",
  "#7fffff",
  "#7fbfff",
  "#7f7fff",
  "#bf7fff",
  "#ff7fbf",
  "#ff7f9f",
];
