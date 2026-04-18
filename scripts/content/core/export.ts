import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type CsvScalar = string | number | boolean | null | undefined;

export interface WriteExportArtifactsOptions<TItem extends object> {
  outputDir: string;
  fileBase: string;
  jsonPayload: unknown;
  items: TItem[];
  csvColumns: Array<Extract<keyof TItem, string>>;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toCsvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(" | ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toCsv<TItem extends object>(
  items: TItem[],
  columns: Array<Extract<keyof TItem, string>>,
): string {
  const lines = [columns.join(",")];

  for (const item of items) {
    const row = columns.map((column) => {
      const value = (item as Record<string, unknown>)[column];
      return csvEscape(toCsvCell(value));
    });
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export async function writeExportArtifacts<TItem extends object>({
  outputDir,
  fileBase,
  jsonPayload,
  items,
  csvColumns,
}: WriteExportArtifactsOptions<TItem>): Promise<{ jsonPath: string; csvPath: string }> {
  await mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `${fileBase}.json`);
  const csvPath = path.join(outputDir, `${fileBase}.csv`);

  await writeFile(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(items, csvColumns)}\n`, "utf8");

  return { jsonPath, csvPath };
}
