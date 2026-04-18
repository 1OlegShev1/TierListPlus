export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return next;
}

export function getArgValues(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1] as string);
      index += 1;
    }
  }
  return values;
}

export function getOptionalYearArg(raw: string | undefined): number | null {
  if (!raw) return null;
  if (!/^\d{4}$/.test(raw)) {
    throw new Error(`Invalid --year value "${raw}". Expected 4 digits.`);
  }
  return Number.parseInt(raw, 10);
}

export function getYearArgOrCurrent(raw: string | undefined): number {
  if (!raw) return new Date().getFullYear();
  const parsed = getOptionalYearArg(raw);
  if (parsed === null) {
    throw new Error("Invalid --year value.");
  }
  return parsed;
}

export function getPositiveIntArg(
  raw: string | undefined,
  flag: string,
  fallback: number,
): number {
  if (raw == null) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid ${flag} value "${raw}". Expected a positive integer.`);
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} value "${raw}". Expected a positive integer.`);
  }
  return parsed;
}

export function getFloatArgInRange(
  raw: string | undefined,
  flag: string,
  fallback: number,
  minInclusive: number,
  maxInclusive: number,
): number {
  if (raw == null) return fallback;
  const trimmed = raw.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    throw new Error(
      `Invalid ${flag} value "${raw}". Expected a number between ${minInclusive} and ${maxInclusive}.`,
    );
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < minInclusive || parsed > maxInclusive) {
    throw new Error(
      `Invalid ${flag} value "${raw}". Expected a number between ${minInclusive} and ${maxInclusive}.`,
    );
  }
  return parsed;
}

export function stripArgWithValue(args: string[], flag: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) {
      index += 1;
      continue;
    }
    result.push(args[index] as string);
  }
  return result;
}

export function toFileSlug(input: string): string {
  const collapsed = input.trim().toLowerCase().replace(/\s+/g, "-");
  const sanitized = collapsed.replace(/[^a-z0-9-_]/g, "");
  return sanitized || "export";
}
