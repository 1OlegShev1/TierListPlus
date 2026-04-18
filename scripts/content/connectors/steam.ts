import path from "node:path";
import {
  getArgValue,
  getFloatArgInRange,
  getOptionalYearArg,
  getPositiveIntArg,
  hasFlag,
  toFileSlug,
} from "../core/args";
import { writeExportArtifacts } from "../core/export";
import {
  createPrismaClientFromEnv,
  publishCollectionAsTemplate,
  resolveImportCreatorId,
} from "../core/publish";

const DEFAULT_OUTPUT_DIR = path.join("scripts", "output", "steam");
const DEFAULT_TEMPLATE_PREFIX = "Steam";
const FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_FETCH_CONCURRENCY = 8;

type SteamPreset = "SURVIVAL_FRIENDS";
type SteamQueryType = "genre" | "tag";

interface SteamSpyEntry {
  appid: number;
  name: string;
  positive: number;
  negative: number;
  owners: string | null;
  ccu: number;
}

interface SteamStoreGenre {
  id: string;
  description: string;
}

interface SteamStoreCategory {
  id: number;
  description: string;
}

interface SteamStoreData {
  type: string;
  name: string;
  steam_appid: number;
  header_image: string;
  is_free: boolean;
  genres?: SteamStoreGenre[];
  categories?: SteamStoreCategory[];
  release_date?: {
    coming_soon: boolean;
    date: string;
  };
}

interface EnrichedSteamGame {
  appid: number;
  label: string;
  imageUrl: string;
  sourceUrl: string;
  sourceNote: string;
  releaseDate: string | null;
  releaseYear: number | null;
  isFree: boolean;
  genres: string[];
  positiveReviews: number;
  negativeReviews: number;
  totalReviews: number;
  positiveRatio: number;
  owners: string | null;
  ccu: number;
  score: number;
}

interface SteamExportItem {
  label: string;
  sourceUrl: string;
  imageUrl: string;
  sourceNote: string;
  steamAppId: number;
  releaseDate: string | null;
  releaseYear: number | null;
  isFree: boolean;
  genres: string;
  positiveReviews: number;
  negativeReviews: number;
  totalReviews: number;
  positiveRatio: number;
  owners: string | null;
  ccu: number;
  score: number;
}

interface SteamExport {
  key: string;
  title: string;
  sourcePage: string;
  generatedAt: string;
  itemCount: number;
  criteria: {
    queryType: SteamQueryType;
    query: string;
    year: number | null;
    minReviews: number;
    minPositiveRatio: number;
    includeEarlyAccess: boolean;
    candidateLimit: number;
    top: number;
    preset: string | null;
  };
  items: SteamExportItem[];
}

interface CliOptions {
  queryType: SteamQueryType;
  query: string;
  year: number | null;
  minReviews: number;
  minPositiveRatio: number;
  includeEarlyAccess: boolean;
  candidateLimit: number;
  top: number;
  outputDir: string;
  importDb: boolean;
  creatorId: string | null;
  isPublic: boolean;
  templatePrefix: string;
  preset: SteamPreset | null;
}

export function printSteamUsage() {
  console.log(`Usage:
  npm run import:content -- --source steam --preset survival-friends
  npm run import:content -- --source steam --tag Survival --top 40
  npm run import:steam -- --preset survival-friends --import-db --creator-id <USER_ID>

Options:
  --preset <NAME>          Supported: survival-friends
  --tag <TXT>              SteamSpy tag query (recommended for survival-like topics)
  --genre <TXT>            SteamSpy genre query
  --year <YYYY>            Optional release year filter
  --min-reviews <N>        Minimum review count (positive + negative)
  --min-positive-ratio <N> Minimum ratio from 0 to 1 (default preset: 0.75)
  --exclude-early-access   Exclude Early Access games
  --candidate-limit <N>    Max SteamSpy candidates to enrich (default preset: 250)
  --top <N>                Number of final items (default preset: 40)
  --out-dir <PATH>         Output directory for JSON/CSV exports
  --import-db              Also create template + items in local DB
  --creator-id <USER_ID>   Optional override for import creator
  --public                 Mark imported template as public
  --template-prefix <TXT>  Template name prefix (default: Steam)
  --help                   Show help`);
}

function parsePreset(raw: string | undefined): SteamPreset | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "survival-friends") return "SURVIVAL_FRIENDS";
  throw new Error(`Unsupported preset "${raw}". Supported presets: survival-friends`);
}

function parseQueryArgs(args: string[], preset: SteamPreset | null): {
  queryType: SteamQueryType;
  query: string;
} {
  const tagArg = getArgValue(args, "--tag")?.trim();
  const genreArg = getArgValue(args, "--genre")?.trim();

  if (tagArg && genreArg) {
    throw new Error("Use either --tag or --genre, not both.");
  }

  if (tagArg) return { queryType: "tag", query: tagArg };
  if (genreArg) return { queryType: "genre", query: genreArg };
  if (preset === "SURVIVAL_FRIENDS") return { queryType: "tag", query: "Survival" };
  return { queryType: "tag", query: "Survival" };
}

function parseArgs(args: string[]): CliOptions | null {
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printSteamUsage();
    return null;
  }

  const preset = parsePreset(getArgValue(args, "--preset"));
  const { queryType, query } = parseQueryArgs(args, preset);

  const year = getOptionalYearArg(getArgValue(args, "--year"));
  const minReviews = getPositiveIntArg(
    getArgValue(args, "--min-reviews"),
    "--min-reviews",
    preset === "SURVIVAL_FRIENDS" ? 1000 : 300,
  );
  const minPositiveRatio = getFloatArgInRange(
    getArgValue(args, "--min-positive-ratio"),
    "--min-positive-ratio",
    preset === "SURVIVAL_FRIENDS" ? 0.75 : 0.65,
    0,
    1,
  );
  const includeEarlyAccess = !hasFlag(args, "--exclude-early-access");
  const candidateLimit = getPositiveIntArg(
    getArgValue(args, "--candidate-limit"),
    "--candidate-limit",
    preset === "SURVIVAL_FRIENDS" ? 250 : 200,
  );
  const top = getPositiveIntArg(
    getArgValue(args, "--top"),
    "--top",
    preset === "SURVIVAL_FRIENDS" ? 40 : 50,
  );

  const outputDir = getArgValue(args, "--out-dir") ?? DEFAULT_OUTPUT_DIR;
  const importDb = hasFlag(args, "--import-db");
  const creatorId = getArgValue(args, "--creator-id") ?? null;
  const isPublic = hasFlag(args, "--public");
  const templatePrefix = (getArgValue(args, "--template-prefix") ?? DEFAULT_TEMPLATE_PREFIX).trim();

  if (!templatePrefix) {
    throw new Error("--template-prefix cannot be empty");
  }

  return {
    queryType,
    query,
    year,
    minReviews,
    minPositiveRatio,
    includeEarlyAccess,
    candidateLimit,
    top,
    outputDir,
    importDb,
    creatorId,
    isPublic,
    templatePrefix,
    preset,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function toSteamSpyEntries(payload: Record<string, unknown>): SteamSpyEntry[] {
  const entries: SteamSpyEntry[] = [];

  for (const [key, value] of Object.entries(payload)) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const appid = Number(record.appid ?? key);
    const name = typeof record.name === "string" ? record.name : null;
    if (!Number.isFinite(appid) || !name) continue;

    entries.push({
      appid,
      name,
      positive: Number(record.positive ?? 0),
      negative: Number(record.negative ?? 0),
      owners: typeof record.owners === "string" ? record.owners : null,
      ccu: Number(record.ccu ?? 0),
    });
  }

  return entries;
}

async function fetchSteamSpy(
  queryType: SteamQueryType,
  query: string,
): Promise<SteamSpyEntry[]> {
  const paramName = queryType === "genre" ? "genre" : "tag";
  const url = `https://steamspy.com/api.php?request=${queryType}&${paramName}=${encodeURIComponent(query)}`;
  const payload = await fetchJson<Record<string, unknown>>(url);
  return toSteamSpyEntries(payload);
}

async function fetchSteamStoreAppDetails(appid: number): Promise<SteamStoreData | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`;
  const payload = await fetchJson<Record<string, { success?: boolean; data?: SteamStoreData }>>(url);
  const entry = payload[String(appid)];
  if (!entry?.success || !entry.data) return null;
  return entry.data;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      results[currentIndex] = await mapper(item);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function parseReleaseYear(dateText: string | null | undefined): number | null {
  if (!dateText) return null;
  const match = /\b(19|20)\d{2}\b/.exec(dateText);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

function parseOwnersMidpoint(raw: string | null): number | null {
  if (!raw) return null;
  const match = /^\s*([\d,]+)\s*\.\.\s*([\d,]+)\s*$/.exec(raw);
  if (!match) return null;
  const lower = Number.parseInt((match[1] ?? "0").replaceAll(",", ""), 10);
  const upper = Number.parseInt((match[2] ?? "0").replaceAll(",", ""), 10);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  return (lower + upper) / 2;
}

function wilsonLowerBound(positive: number, negative: number): number {
  const n = positive + negative;
  if (n <= 0) return 0;

  const z = 1.96;
  const p = positive / n;
  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return (center / denominator) - margin;
}

function isEarlyAccess(data: SteamStoreData): boolean {
  const categories = data.categories ?? [];
  return categories.some((category) =>
    category.description.toLowerCase().includes("early access"),
  );
}

function buildSourceNote(query: string, releaseYear: number | null): string {
  const note = releaseYear ? `Steam ${query} • ${releaseYear}` : `Steam ${query}`;
  return note.slice(0, 120);
}

function computeScore(candidate: SteamSpyEntry): number {
  const quality = wilsonLowerBound(candidate.positive, candidate.negative) * 100;
  const owners = parseOwnersMidpoint(candidate.owners);
  const ownersSignal = owners ? Math.log10(owners + 1) * 0.35 : 0;
  const ccuSignal = Math.log10(Math.max(0, candidate.ccu) + 1);
  return quality + ownersSignal + ccuSignal;
}

function toSteamExportItems(games: EnrichedSteamGame[]): SteamExportItem[] {
  return games.map((game) => ({
    label: game.label,
    sourceUrl: game.sourceUrl,
    imageUrl: game.imageUrl,
    sourceNote: game.sourceNote,
    steamAppId: game.appid,
    releaseDate: game.releaseDate,
    releaseYear: game.releaseYear,
    isFree: game.isFree,
    genres: game.genres.join(" | "),
    positiveReviews: game.positiveReviews,
    negativeReviews: game.negativeReviews,
    totalReviews: game.totalReviews,
    positiveRatio: Number(game.positiveRatio.toFixed(4)),
    owners: game.owners,
    ccu: game.ccu,
    score: Number(game.score.toFixed(4)),
  }));
}

function shouldKeepGame(options: CliOptions, candidate: SteamSpyEntry, data: SteamStoreData): boolean {
  if (data.type !== "game") return false;
  if (!data.header_image?.trim()) return false;
  if (data.release_date?.coming_soon) return false;
  if (!options.includeEarlyAccess && isEarlyAccess(data)) return false;

  const totalReviews = Math.max(0, candidate.positive) + Math.max(0, candidate.negative);
  if (totalReviews < options.minReviews) return false;

  const positiveRatio = totalReviews > 0 ? candidate.positive / totalReviews : 0;
  if (positiveRatio < options.minPositiveRatio) return false;

  if (options.year !== null) {
    const releaseYear = parseReleaseYear(data.release_date?.date);
    if (releaseYear !== options.year) return false;
  }

  return true;
}

async function buildRankedGames(options: CliOptions): Promise<EnrichedSteamGame[]> {
  let allCandidates = await fetchSteamSpy(options.queryType, options.query);
  if (allCandidates.length === 0 && options.queryType === "genre") {
    allCandidates = await fetchSteamSpy("tag", options.query);
    if (allCandidates.length > 0) {
      console.log(
        `No results for genre "${options.query}". Falling back to SteamSpy tag "${options.query}".`,
      );
    }
  }

  const sortedCandidates = [...allCandidates]
    .sort((left, right) => {
      const leftReviews = left.positive + left.negative;
      const rightReviews = right.positive + right.negative;
      if (rightReviews !== leftReviews) return rightReviews - leftReviews;
      return right.ccu - left.ccu;
    })
    .slice(0, options.candidateLimit);

  const details = await mapWithConcurrency(
    sortedCandidates,
    DEFAULT_FETCH_CONCURRENCY,
    async (candidate) => {
      try {
        const storeData = await fetchSteamStoreAppDetails(candidate.appid);
        return { candidate, storeData };
      } catch {
        return { candidate, storeData: null };
      }
    },
  );

  const ranked: EnrichedSteamGame[] = [];
  for (const entry of details) {
    if (!entry.storeData) continue;
    if (!shouldKeepGame(options, entry.candidate, entry.storeData)) continue;

    const releaseDate = entry.storeData.release_date?.date?.trim() ?? null;
    const releaseYear = parseReleaseYear(releaseDate);
    const totalReviews = Math.max(0, entry.candidate.positive) + Math.max(0, entry.candidate.negative);
    const positiveRatio = totalReviews > 0 ? entry.candidate.positive / totalReviews : 0;

    ranked.push({
      appid: entry.candidate.appid,
      label: entry.storeData.name.trim(),
      imageUrl: entry.storeData.header_image.trim(),
      sourceUrl: `https://store.steampowered.com/app/${entry.candidate.appid}/`,
      sourceNote: buildSourceNote(options.query, releaseYear),
      releaseDate,
      releaseYear,
      isFree: entry.storeData.is_free === true,
      genres: (entry.storeData.genres ?? []).map((genre) => genre.description),
      positiveReviews: Math.max(0, entry.candidate.positive),
      negativeReviews: Math.max(0, entry.candidate.negative),
      totalReviews,
      positiveRatio,
      owners: entry.candidate.owners,
      ccu: Math.max(0, entry.candidate.ccu),
      score: computeScore(entry.candidate),
    });
  }

  return ranked.sort((left, right) => right.score - left.score);
}

function buildTemplateSuffix(options: CliOptions): string {
  if (options.preset === "SURVIVAL_FRIENDS") {
    return "Survival Games (Friends)";
  }
  const yearPart = options.year ? ` ${options.year}` : "";
  return `${options.query} Games${yearPart}`;
}

function resolveSourcePage(options: CliOptions): string {
  const segment = options.queryType === "genre" ? "genre" : "tag";
  return `https://steamspy.com/${segment}/${encodeURIComponent(options.query)}`;
}

export async function runSteamImport(args: string[]): Promise<void> {
  const options = parseArgs(args);
  if (!options) return;

  console.log(`Query: ${options.queryType}=${options.query}`);
  console.log(`Top: ${options.top}`);
  console.log(`Candidate limit: ${options.candidateLimit}`);
  console.log(`Output: ${options.outputDir}`);
  if (options.importDb) {
    console.log(`DB import enabled for creator ${options.creatorId}`);
  }

  const rankedGames = await buildRankedGames(options);
  const trimmed = rankedGames.slice(0, options.top);
  const exportItems = toSteamExportItems(trimmed);

  const exportKey =
    options.preset === "SURVIVAL_FRIENDS"
      ? "survival-friends"
      : toFileSlug(`${options.query}-${options.year ?? "all"}`);
  const exportTitle =
    options.preset === "SURVIVAL_FRIENDS"
      ? "Steam Survival Games (Friends)"
      : `Steam ${options.query} Games`;
  const sourcePage = resolveSourcePage(options);
  const generatedAt = new Date().toISOString();

  const exportPayload: SteamExport = {
    key: exportKey,
    title: exportTitle,
    sourcePage,
    generatedAt,
    itemCount: exportItems.length,
    criteria: {
      queryType: options.queryType,
      query: options.query,
      year: options.year,
      minReviews: options.minReviews,
      minPositiveRatio: options.minPositiveRatio,
      includeEarlyAccess: options.includeEarlyAccess,
      candidateLimit: options.candidateLimit,
      top: options.top,
      preset: options.preset === "SURVIVAL_FRIENDS" ? "survival-friends" : null,
    },
    items: exportItems,
  };

  const artifacts = await writeExportArtifacts({
    outputDir: options.outputDir,
    fileBase: exportKey,
    jsonPayload: exportPayload,
    items: exportItems,
    csvColumns: [
      "label",
      "sourceUrl",
      "imageUrl",
      "sourceNote",
      "steamAppId",
      "releaseDate",
      "releaseYear",
      "isFree",
      "genres",
      "positiveReviews",
      "negativeReviews",
      "totalReviews",
      "positiveRatio",
      "owners",
      "ccu",
      "score",
    ],
  });

  console.log(`Exported ${exportItems.length} items: ${artifacts.jsonPath}`);
  console.log(`Exported CSV: ${artifacts.csvPath}`);

  if (!options.importDb) return;

  const prisma = createPrismaClientFromEnv();
  try {
    const resolvedCreatorId = await resolveImportCreatorId(prisma, options.creatorId);
    console.log(`Resolved import creator: ${resolvedCreatorId}`);
    const published = await publishCollectionAsTemplate(prisma, {
      creatorId: resolvedCreatorId,
      isPublic: options.isPublic,
      templatePrefix: options.templatePrefix,
      templateSuffix: buildTemplateSuffix(options),
      sourcePage,
      importedAtIso: generatedAt,
      items: trimmed.map((game) => ({
        label: game.label,
        imageUrl: game.imageUrl,
        sourceUrl: game.sourceUrl,
        sourceNote: game.sourceNote,
      })),
    });

    console.log(
      `Created template "${published.name}" (${published.id}) with ${published.itemCount} items`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
