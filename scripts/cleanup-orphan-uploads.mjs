import fs from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const UNATTACHED_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MANAGED_UPLOAD_URL_RE = /^\/uploads\/([A-Za-z0-9_-]+\.webp)$/;
const MANAGED_UPLOAD_FILE_RE = /^[A-Za-z0-9_-]+\.webp$/;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function extractManagedUploadFilename(imageUrl) {
  const match = MANAGED_UPLOAD_URL_RE.exec(imageUrl);
  return match?.[1] ?? null;
}

async function getReferencedUploadFilenames() {
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

  const referenced = new Set();
  for (const { imageUrl } of [...templateImages, ...sessionImages]) {
    const filename = extractManagedUploadFilename(imageUrl);
    if (filename) referenced.add(filename);
  }

  return referenced;
}

async function main() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const referenced = await getReferencedUploadFilenames();
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  const nowMs = Date.now();

  let deletedFiles = 0;
  let deletedBytes = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (!MANAGED_UPLOAD_FILE_RE.test(entry.name)) continue;
    if (referenced.has(entry.name)) continue;

    const filepath = path.join(UPLOAD_DIR, entry.name);
    const stat = await fs.stat(filepath).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (!stat) continue;

    if (nowMs - stat.mtimeMs < UNATTACHED_UPLOAD_RETENTION_MS) continue;

    await fs.unlink(filepath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    deletedFiles += 1;
    deletedBytes += stat.size;
  }

  console.log(
    `Deleted ${deletedFiles} unattached upload(s), reclaimed ${deletedBytes} bytes, retention ${Math.round(
      UNATTACHED_UPLOAD_RETENTION_MS / (60 * 60 * 1000),
    )}h.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
