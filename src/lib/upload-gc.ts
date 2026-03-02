import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { UNATTACHED_UPLOAD_RETENTION_MS } from "./upload-config";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MANAGED_UPLOAD_URL_RE = /^\/uploads\/([A-Za-z0-9_-]+\.webp)$/;
const MANAGED_UPLOAD_FILE_RE = /^[A-Za-z0-9_-]+\.webp$/;

function extractManagedUploadFilename(imageUrl: string): string | null {
  const match = MANAGED_UPLOAD_URL_RE.exec(imageUrl);
  return match?.[1] ?? null;
}

async function isImageUrlStillReferenced(imageUrl: string): Promise<boolean> {
  const [templateCount, sessionCount] = await Promise.all([
    prisma.templateItem.count({ where: { imageUrl } }),
    prisma.sessionItem.count({ where: { imageUrl } }),
  ]);

  return templateCount + sessionCount > 0;
}

async function getReferencedUploadFilenames(): Promise<Set<string>> {
  const [templateImages, sessionImages] = await Promise.all([
    prisma.templateItem.findMany({
      distinct: ["imageUrl"],
      select: { imageUrl: true },
    }),
    prisma.sessionItem.findMany({
      distinct: ["imageUrl"],
      select: { imageUrl: true },
    }),
  ]);

  const referenced = new Set<string>();
  for (const { imageUrl } of [...templateImages, ...sessionImages]) {
    const filename = extractManagedUploadFilename(imageUrl);
    if (filename) referenced.add(filename);
  }

  return referenced;
}

export async function deleteManagedUploadIfUnreferenced(imageUrl: string): Promise<boolean> {
  const filename = extractManagedUploadFilename(imageUrl);
  if (!filename) return false;

  if (await isImageUrlStillReferenced(imageUrl)) {
    return false;
  }

  const filepath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.unlink(filepath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function tryDeleteManagedUploadIfUnreferenced(
  imageUrl: string,
  context: string,
): Promise<boolean> {
  try {
    return await deleteManagedUploadIfUnreferenced(imageUrl);
  } catch (error) {
    console.error(`Upload cleanup failed after ${context}`, { imageUrl, error });
    return false;
  }
}

export async function sweepStaleUnattachedUploads(
  options: { minAgeMs?: number } = {},
): Promise<{ deletedFiles: number; deletedBytes: number }> {
  const nowMs = Date.now();
  const minAgeMs = options.minAgeMs ?? UNATTACHED_UPLOAD_RETENTION_MS;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const referenced = await getReferencedUploadFilenames();
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  let deletedFiles = 0;
  let deletedBytes = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (!MANAGED_UPLOAD_FILE_RE.test(entry.name)) continue;
    if (referenced.has(entry.name)) continue;

    const filepath = path.join(UPLOAD_DIR, entry.name);

    const stat = await fs.stat(filepath).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    });
    if (!stat) continue;

    if (nowMs - stat.mtimeMs < minAgeMs) continue;

    await fs.unlink(filepath).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    deletedFiles += 1;
    deletedBytes += stat.size;
  }

  return { deletedFiles, deletedBytes };
}
