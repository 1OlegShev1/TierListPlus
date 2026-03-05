import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { UNATTACHED_UPLOAD_RETENTION_MS } from "./upload-config";
import {
  extractManagedUploadFilename,
  getCompanionUploadFilenames,
  MANAGED_UPLOAD_FILE_RE,
} from "./uploads";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function isImageUrlStillReferenced(imageUrl: string): Promise<boolean> {
  const [templateCount, sessionCount, spaceCount] = await Promise.all([
    prisma.templateItem.count({ where: { imageUrl } }),
    prisma.sessionItem.count({ where: { imageUrl } }),
    prisma.space.count({ where: { logoUrl: imageUrl } }),
  ]);

  return templateCount + sessionCount + spaceCount > 0;
}

async function getReferencedUploadFilenames(): Promise<Set<string>> {
  const [templateImages, sessionImages, spaceLogos] = await Promise.all([
    prisma.templateItem.findMany({
      distinct: ["imageUrl"],
      select: { imageUrl: true },
    }),
    prisma.sessionItem.findMany({
      distinct: ["imageUrl"],
      select: { imageUrl: true },
    }),
    prisma.space.findMany({
      where: { logoUrl: { not: null } },
      distinct: ["logoUrl"],
      select: { logoUrl: true },
    }),
  ]);

  const referenced = new Set<string>();
  for (const { imageUrl } of [...templateImages, ...sessionImages]) {
    const filename = extractManagedUploadFilename(imageUrl);
    if (!filename) continue;
    referenced.add(filename);
    for (const companion of getCompanionUploadFilenames(filename)) {
      referenced.add(companion);
    }
  }
  for (const { logoUrl } of spaceLogos) {
    if (!logoUrl) continue;
    const filename = extractManagedUploadFilename(logoUrl);
    if (!filename) continue;
    referenced.add(filename);
    for (const companion of getCompanionUploadFilenames(filename)) {
      referenced.add(companion);
    }
  }

  return referenced;
}

export async function deleteManagedUploadIfUnreferenced(imageUrl: string): Promise<boolean> {
  const filename = extractManagedUploadFilename(imageUrl);
  if (!filename) return false;

  if (await isImageUrlStillReferenced(imageUrl)) {
    return false;
  }

  const filenames = [filename, ...getCompanionUploadFilenames(filename)];
  let deletedAny = false;

  for (const fileToDelete of filenames) {
    const filepath = path.join(UPLOAD_DIR, fileToDelete);
    try {
      await fs.unlink(filepath);
      deletedAny = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  return deletedAny;
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
