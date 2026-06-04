import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  getArgValue,
  getArgValues,
  getFloatArgInRange,
  getPositiveIntArg,
  getYearArgOrCurrent,
  hasFlag,
} from "../core/args";
import { writeExportArtifacts } from "../core/export";
import {
  createPrismaClientFromEnv,
  publishCollectionAsTemplate,
  resolveImportCreatorId,
} from "../core/publish";

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co/";
const DEFAULT_OUTPUT_DIR = path.join("scripts", "output", "anichart");
const DEFAULT_TEMPLATE_PREFIX = "AniChart";
const FETCH_TIMEOUT_MS = 20_000;

// Filtering defaults. Keep an item if it's popular enough, OR well-rated with a
// real sample (so a high score from a tiny audience doesn't sneak in). Scores
// only exist once a show airs, so on unaired seasons the score prong is inert
// and the popularity floor governs.
const DEFAULT_POP_FLOOR = 5000;
const DEFAULT_SCORE_FLOOR = 70; // averageScore, 0-100
const DEFAULT_MIN_POP_FOR_SCORE = 2000;
// AniChart categories we never want on a tier-list bench.
const DROPPED_FORMATS = new Set(["TV_SHORT"]);

const SEASON_NAMES = ["Winter", "Spring", "Summer", "Fall"] as const;
type SeasonName = (typeof SEASON_NAMES)[number];
type SeasonLower = Lowercase<SeasonName>;

interface SeasonSpec {
  season: SeasonLower;
  year: number;
  slug: `${SeasonName}-${number}`;
}

interface TitleBlock {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface MediaRank {
  rank: number;
  type: "RATED" | "POPULAR";
  season: string | null;
  year: number | null;
  allTime: boolean;
  format: string | null;
}

interface RawMedia {
  id: number;
  title: TitleBlock;
  source: string | null;
  siteUrl: string | null;
  popularity: number | null;
  averageScore: number | null;
  format: string | null;
  coverImage: {
    extraLarge: string | null;
  };
  rankings: MediaRank[];
}

interface SeasonQueryData {
  Page: {
    pageInfo: {
      hasNextPage: boolean;
      total: number;
    };
    media: RawMedia[];
  };
}

interface ExportItem {
  label: string;
  sourceUrl: string;
  imageUrl: string;
  sourceNote: string;
  sourceType: string | null;
  popularityRank: number | null;
  popularity: number | null;
  averageScore: number | null;
  format: string | null;
  anichartSeasonUrl: string;
  cardTargetUrl: string;
  anilistId: number;
}

interface SeasonExport {
  season: string;
  sourcePage: string;
  generatedAt: string;
  itemCount: number;
  items: ExportItem[];
}

interface CliOptions {
  seasons: SeasonSpec[];
  outputDir: string;
  importDb: boolean;
  creatorId: string | null;
  isPublic: boolean;
  templatePrefix: string;
  replace: boolean;
  spaceId: string | null;
  popFloor: number;
  scoreFloor: number;
  minPopForScore: number;
  includeLeftovers: boolean;
  includeTvShorts: boolean;
}

interface FilterOptions {
  popFloor: number;
  scoreFloor: number;
  minPopForScore: number;
  dropFormats: Set<string>;
}

const SEASON_QUERY = `
query (
  $season: MediaSeason,
  $year: Int,
  $format: MediaFormat,
  $excludeFormat: MediaFormat,
  $minEpisodes: Int,
  $page: Int
) {
  Page(page: $page) {
    pageInfo {
      hasNextPage
      total
    }
    media(
      season: $season
      seasonYear: $year
      format: $format
      format_not: $excludeFormat
      episodes_greater: $minEpisodes
      isAdult: false
      type: ANIME
      sort: TITLE_ROMAJI
    ) {
      id
      title {
        romaji
        english
        native
      }
      source(version: 2)
      siteUrl
      popularity
      averageScore
      format
      coverImage {
        extraLarge
      }
      rankings {
        rank
        type
        season
        year
        allTime
        format
      }
    }
  }
}
`;

export function printAniChartUsage() {
  console.log(`Usage:
  npm run import:anichart -- [--season Spring-2026] [--season Summer-2026]
  npm run import:anichart -- [--year 2026]
  npm run import:anichart -- --year 2026 --import-db --creator-id <USER_ID>
  npm run import:content -- --source anichart --year 2026

Options:
  --season <Season-Year>   Import one season (repeatable). Example: Spring-2026
  --year <YYYY>            If --season is omitted, imports Winter/Spring/Summer/Fall for this year
  --out-dir <PATH>         Output directory for JSON/CSV exports
  --import-db              Also create templates + items in local DB
  --creator-id <USER_ID>   Optional override for import creator
  --public                 Mark imported templates as public
  --template-prefix <TXT>  Template name prefix (default: AniChart)
  --replace                Replace existing same-named templates (clean redo).
                           Skips any that already have sessions.
  --space-id <SPACE_ID>    Create templates inside this space (forces non-public).
                           With --replace, migrates same-named templates in.
  --pop-floor <N>          Keep items with popularity >= N (default 5000)
  --score-floor <N>        ...or averageScore >= N% (default 70), with
  --min-pop-for-score <N>  popularity >= N (default 2000) to avoid tiny samples
  --include-leftovers      Include shows carried over from the previous season
  --include-tv-shorts      Include TV_SHORT format (dropped by default)
  --help                   Show help`);
}

function toTitleSeasonName(raw: string): SeasonName | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "winter") return "Winter";
  if (normalized === "spring") return "Spring";
  if (normalized === "summer") return "Summer";
  if (normalized === "fall") return "Fall";
  return null;
}

function parseSeasonSlug(raw: string): SeasonSpec {
  const match = /^([a-z]+)-(\d{4})$/i.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid season "${raw}". Expected format like Spring-2026`);
  }

  const seasonName = toTitleSeasonName(match[1] ?? "");
  if (!seasonName) {
    throw new Error(`Invalid season name in "${raw}". Use Winter, Spring, Summer, or Fall`);
  }

  const year = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(year) || year < 1900 || year > 3000) {
    throw new Error(`Invalid year in "${raw}"`);
  }

  return {
    season: seasonName.toLowerCase() as SeasonLower,
    year,
    slug: `${seasonName}-${year}`,
  };
}

function buildSeasonsForYear(year: number): SeasonSpec[] {
  return SEASON_NAMES.map((seasonName) => ({
    season: seasonName.toLowerCase() as SeasonLower,
    year,
    slug: `${seasonName}-${year}`,
  }));
}

function parseArgs(args: string[]): CliOptions | null {
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printAniChartUsage();
    return null;
  }

  const seasonArgs = getArgValues(args, "--season");
  const seasons =
    seasonArgs.length > 0
      ? seasonArgs.map((seasonArg) => parseSeasonSlug(seasonArg))
      : buildSeasonsForYear(getYearArgOrCurrent(getArgValue(args, "--year")));

  const outputDir = getArgValue(args, "--out-dir") ?? DEFAULT_OUTPUT_DIR;
  const importDb = hasFlag(args, "--import-db");
  const creatorId = getArgValue(args, "--creator-id") ?? null;
  const isPublic = hasFlag(args, "--public");
  const templatePrefix = (getArgValue(args, "--template-prefix") ?? DEFAULT_TEMPLATE_PREFIX).trim();
  const replace = hasFlag(args, "--replace");
  const spaceId = getArgValue(args, "--space-id") ?? null;
  const popFloor = getPositiveIntArg(
    getArgValue(args, "--pop-floor"),
    "--pop-floor",
    DEFAULT_POP_FLOOR,
  );
  const scoreFloor = getFloatArgInRange(
    getArgValue(args, "--score-floor"),
    "--score-floor",
    DEFAULT_SCORE_FLOOR,
    0,
    100,
  );
  const minPopForScore = getPositiveIntArg(
    getArgValue(args, "--min-pop-for-score"),
    "--min-pop-for-score",
    DEFAULT_MIN_POP_FOR_SCORE,
  );
  const includeLeftovers = hasFlag(args, "--include-leftovers");
  const includeTvShorts = hasFlag(args, "--include-tv-shorts");

  if (!templatePrefix) {
    throw new Error("--template-prefix cannot be empty");
  }

  return {
    seasons,
    outputDir,
    importDb,
    creatorId,
    isPublic,
    templatePrefix,
    replace,
    spaceId,
    popFloor,
    scoreFloor,
    minPopForScore,
    includeLeftovers,
    includeTvShorts,
  };
}

function getPreviousSeason(
  season: SeasonLower,
  year: number,
): { season: SeasonLower; year: number } {
  if (season === "winter") {
    return { season: "fall", year: year - 1 };
  }

  if (season === "spring") {
    return { season: "winter", year };
  }

  if (season === "summer") {
    return { season: "spring", year };
  }

  return { season: "summer", year };
}

function pickLabel(title: TitleBlock, id: number): string {
  return title.romaji ?? title.english ?? title.native ?? `AniList #${id}`;
}

async function requestAniList<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) {
      throw new Error(`AniList request failed (${response.status})`);
    }

    if (!payload.data) {
      const firstError = payload.errors?.[0]?.message ?? "Unknown AniList GraphQL error";
      throw new Error(`AniList GraphQL error: ${firstError}`);
    }

    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSeasonMedia(
  season: SeasonSpec,
  includeLeftovers: boolean,
): Promise<RawMedia[]> {
  const variableSets: Array<Record<string, unknown>> = [
    { season: season.season.toUpperCase(), year: season.year, format: "TV" },
    { season: season.season.toUpperCase(), year: season.year, excludeFormat: "TV" },
  ];

  // "Leftovers": shows that started last season and continue into this one.
  // Off by default — they were already in the previous season's list.
  if (includeLeftovers) {
    const previousSeason = getPreviousSeason(season.season, season.year);
    variableSets.push({
      season: previousSeason.season.toUpperCase(),
      year: previousSeason.year,
      minEpisodes: 16,
    });
  }

  const unique = new Map<number, RawMedia>();

  for (const baseVariables of variableSets) {
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const data = await requestAniList<SeasonQueryData>(SEASON_QUERY, {
        ...baseVariables,
        page,
      });

      for (const media of data.Page.media) {
        if (!unique.has(media.id)) {
          unique.set(media.id, media);
        }
      }

      hasNextPage = data.Page.pageInfo.hasNextPage;
      page += 1;
    }
  }

  return [...unique.values()];
}

// The "#N" heart badge on an AniChart season page is the in-season popularity
// rank (type POPULAR, scoped to that season/year). AniList scopes this rank
// *per format*, so a TV show and a TV-short can both be "#1". We keep it as a
// reference field, but order the merged list by raw popularity (what AniChart's
// popularity-sorted season view actually shows) so formats interleave sanely.
function pickSeasonPopularityRank(media: RawMedia, season: SeasonSpec): number | null {
  const target = media.rankings.find(
    (ranking) =>
      ranking.type === "POPULAR" &&
      !ranking.allTime &&
      ranking.season === season.season.toUpperCase() &&
      ranking.year === season.year,
  );
  return target?.rank ?? null;
}

// Keep an item if it's popular enough, OR well-rated with a real audience.
// Dropped formats (e.g. TV shorts) are excluded outright.
function keepMedia(media: RawMedia, filter: FilterOptions): boolean {
  if (media.format && filter.dropFormats.has(media.format)) return false;
  const popularity = media.popularity ?? 0;
  if (popularity >= filter.popFloor) return true;
  return (
    media.averageScore != null &&
    media.averageScore >= filter.scoreFloor &&
    popularity >= filter.minPopForScore
  );
}

function mapSeasonExportItems(
  season: SeasonSpec,
  media: RawMedia[],
  filter: FilterOptions,
): ExportItem[] {
  const anichartSeasonUrl = `https://anichart.net/${season.slug}`;

  const items = media
    .filter((entry) => keepMedia(entry, filter))
    .map((entry) => {
      const label = pickLabel(entry.title, entry.id).trim();
      const imageUrl = entry.coverImage.extraLarge?.trim() ?? "";
      const sourceUrl = entry.siteUrl?.trim() ?? "";
      if (!label || !imageUrl || !sourceUrl) return null;

      return {
        label,
        sourceUrl,
        imageUrl,
        sourceType: entry.source,
        popularityRank: pickSeasonPopularityRank(entry, season),
        popularity: entry.popularity,
        averageScore: entry.averageScore,
        format: entry.format,
        sourceNote: `AniChart ${season.slug}`,
        anichartSeasonUrl,
        cardTargetUrl: sourceUrl,
        anilistId: entry.id,
      } satisfies ExportItem;
    })
    .filter((item): item is ExportItem => item !== null);

  // Most popular first — the order AniChart shows when a season is sorted by
  // popularity. Ties (and missing counts) fall back to the in-season rank.
  return items.sort((a, b) => {
    const popDelta = (b.popularity ?? 0) - (a.popularity ?? 0);
    if (popDelta !== 0) return popDelta;
    return (
      (a.popularityRank ?? Number.MAX_SAFE_INTEGER) - (b.popularityRank ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

async function importSeasonExportsToDb(
  prisma: PrismaClient,
  seasonExports: SeasonExport[],
  options: {
    creatorId: string;
    isPublic: boolean;
    templatePrefix: string;
    replace: boolean;
    spaceId: string | null;
  },
): Promise<void> {
  for (const seasonExport of seasonExports) {
    const published = await publishCollectionAsTemplate(prisma, {
      creatorId: options.creatorId,
      isPublic: options.isPublic,
      templatePrefix: options.templatePrefix,
      templateSuffix: seasonExport.season,
      sourcePage: seasonExport.sourcePage,
      importedAtIso: seasonExport.generatedAt,
      replace: options.replace,
      spaceId: options.spaceId,
      items: seasonExport.items.map((item) => ({
        label: item.label,
        imageUrl: item.imageUrl,
        sourceUrl: item.sourceUrl,
        sourceNote: item.sourceNote,
      })),
    });

    console.log(
      `Created template "${published.name}" (${published.id}) with ${published.itemCount} items`,
    );
  }
}

export async function runAniChartImport(args: string[]): Promise<void> {
  const options = parseArgs(args);
  if (!options) return;

  const dropFormats = new Set(options.includeTvShorts ? [] : DROPPED_FORMATS);
  const filter: FilterOptions = {
    popFloor: options.popFloor,
    scoreFloor: options.scoreFloor,
    minPopForScore: options.minPopForScore,
    dropFormats,
  };

  console.log(`Seasons: ${options.seasons.map((season) => season.slug).join(", ")}`);
  console.log(`Output: ${options.outputDir}`);
  console.log(
    `Filter: keep if popularity >= ${filter.popFloor} OR (score >= ${filter.scoreFloor}% AND popularity >= ${filter.minPopForScore}); ` +
      `leftovers ${options.includeLeftovers ? "included" : "dropped"}, ` +
      `dropped formats: ${[...dropFormats].join(", ") || "none"}`,
  );
  if (options.importDb) console.log("DB import enabled");

  const seasonExports: SeasonExport[] = [];

  for (const season of options.seasons) {
    console.log(`Fetching ${season.slug}...`);
    const media = await fetchSeasonMedia(season, options.includeLeftovers);
    const items = mapSeasonExportItems(season, media, filter);
    const seasonExport: SeasonExport = {
      season: season.slug,
      sourcePage: `https://anichart.net/${season.slug}`,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
    };
    seasonExports.push(seasonExport);

    const fileBase = seasonExport.season.toLowerCase();
    const artifacts = await writeExportArtifacts({
      outputDir: options.outputDir,
      fileBase,
      jsonPayload: seasonExport,
      items: seasonExport.items,
      csvColumns: [
        "popularityRank",
        "popularity",
        "averageScore",
        "format",
        "label",
        "sourceUrl",
        "imageUrl",
        "sourceNote",
        "sourceType",
        "anichartSeasonUrl",
        "cardTargetUrl",
        "anilistId",
      ],
    });
    console.log(`Exported ${seasonExport.itemCount} items: ${artifacts.jsonPath}`);
    console.log(`Exported CSV: ${artifacts.csvPath}`);
  }

  if (!options.importDb) return;
  const prisma = createPrismaClientFromEnv();
  try {
    const resolvedCreatorId = await resolveImportCreatorId(prisma, options.creatorId);
    console.log(`Resolved import creator: ${resolvedCreatorId}`);
    await importSeasonExportsToDb(prisma, seasonExports, {
      creatorId: resolvedCreatorId,
      isPublic: options.isPublic,
      templatePrefix: options.templatePrefix,
      replace: options.replace,
      spaceId: options.spaceId,
    });
  } finally {
    await prisma.$disconnect();
  }
}
