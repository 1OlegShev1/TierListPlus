import "dotenv/config";
import { getArgValue, hasFlag, stripArgWithValue } from "./content/core/args";
import { printAniChartUsage, runAniChartImport } from "./content/connectors/anichart";
import { printSteamUsage, runSteamImport } from "./content/connectors/steam";

type ContentSource = "anichart" | "steam";
const CONTENT_SOURCES = new Set<ContentSource>(["anichart", "steam"]);

function printUsage() {
  console.log(`Usage:
  npm run import:content -- -- --source anichart [source options...]
  npm run import:content -- -- --source steam [source options...]
  npx tsx scripts/import-content.ts --source anichart [source options...]

Sources:
  anichart  AniChart season import (anime)
  steam     Steam game import (genre/preset)

Tips:
  On npm/PowerShell, use the extra separator: "-- --" before script flags.
  Example: npm run import:content -- -- --source steam --help
`);
}

function getSourceRunner(source: ContentSource): (args: string[]) => Promise<void> {
  switch (source) {
    case "anichart":
      return runAniChartImport;
    case "steam":
      return runSteamImport;
  }
}

function printSourceHelp(source: ContentSource) {
  if (source === "anichart") {
    printAniChartUsage();
    return;
  }
  printSteamUsage();
}

async function run() {
  const args = process.argv.slice(2);
  const hasFlagTokens = args.some((arg) => arg.startsWith("-"));
  let sourceRaw = getArgValue(args, "--source")?.trim().toLowerCase();
  let sourceArgs = stripArgWithValue(args, "--source");
  const showHelp = hasFlag(args, "--help") || hasFlag(args, "-h");

  // npm on PowerShell can strip flags; accept positional source as a fallback.
  if (!sourceRaw) {
    const positionalSource = args[0]?.trim().toLowerCase();
    if (positionalSource && CONTENT_SOURCES.has(positionalSource as ContentSource)) {
      sourceRaw = positionalSource;
      sourceArgs = args.slice(1);
    }
  }

  if (!sourceRaw) {
    printUsage();
    if (showHelp) return;
    throw new Error('Missing --source. Use "anichart" or "steam".');
  }

  if (sourceRaw !== "anichart" && sourceRaw !== "steam") {
    throw new Error(`Unsupported --source "${sourceRaw}". Use "anichart" or "steam".`);
  }

  const source = sourceRaw as ContentSource;

  if (!hasFlagTokens && sourceArgs.length > 0) {
    throw new Error(
      'Detected positional args without flags. On npm + PowerShell, pass script flags after an extra "--". Example: npm run import:content -- -- --source steam --preset survival-friends',
    );
  }

  if (showHelp) {
    printSourceHelp(source);
    return;
  }

  const runner = getSourceRunner(source);
  await runner(sourceArgs);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
