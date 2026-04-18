import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  getArgValue,
  getArgValues,
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

interface RawMedia {
  id: number;
  title: TitleBlock;
  source: string | null;
  siteUrl: string | null;
  coverImage: {
    extraLarge: string | null;
  };
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
      coverImage {
        extraLarge
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

async function fetchSeasonMedia(season: SeasonSpec): Promise<RawMedia[]> {
  const previousSeason = getPreviousSeason(season.season, season.year);

  const variableSets: Array<Record<string, unknown>> = [
    { season: season.season.toUpperCase(), year: season.year, format: "TV" },
    { season: season.season.toUpperCase(), year: season.year, excludeFormat: "TV" },
    { season: previousSeason.season.toUpperCase(), year: previousSeason.year, minEpisodes: 16 },
  ];

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

function mapSeasonExportItems(season: SeasonSpec, media: RawMedia[]): ExportItem[] {
  const anichartSeasonUrl = `https://anichart.net/${season.slug}`;

  return media
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
        sourceNote: `AniChart ${season.slug}`,
        anichartSeasonUrl,
        cardTargetUrl: sourceUrl,
        anilistId: entry.id,
      } satisfies ExportItem;
    })
    .filter((item): item is ExportItem => item !== null);
}

async function importSeasonExportsToDb(
  prisma: PrismaClient,
  seasonExports: SeasonExport[],
  options: { creatorId: string; isPublic: boolean; templatePrefix: string },
): Promise<void> {
  for (const seasonExport of seasonExports) {
    const published = await publishCollectionAsTemplate(prisma, {
      creatorId: options.creatorId,
      isPublic: options.isPublic,
      templatePrefix: options.templatePrefix,
      templateSuffix: seasonExport.season,
      sourcePage: seasonExport.sourcePage,
      importedAtIso: seasonExport.generatedAt,
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

  console.log(`Seasons: ${options.seasons.map((season) => season.slug).join(", ")}`);
  console.log(`Output: ${options.outputDir}`);
  if (options.importDb) console.log("DB import enabled");

  const seasonExports: SeasonExport[] = [];

  for (const season of options.seasons) {
    console.log(`Fetching ${season.slug}...`);
    const media = await fetchSeasonMedia(season);
    const items = mapSeasonExportItems(season, media);
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
    });
  } finally {
    await prisma.$disconnect();
  }
}
