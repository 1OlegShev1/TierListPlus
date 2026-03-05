import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  PROCESSED_IMAGE_QUALITY,
  PROCESSED_IMAGE_SIZE,
  PROCESSED_SPACE_LOGO_SIZE,
  UPLOAD_MAX_INPUT_PIXELS,
} from "@/lib/upload-config";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
export type UploadImageVariant = "item" | "space_logo";

export class InvalidImageError extends Error {
  constructor(message = "File is not a valid image") {
    super(message);
    this.name = "InvalidImageError";
  }
}

const INVALID_IMAGE_ERROR_PATTERNS = [
  "unsupported image format",
  "corrupt",
  "bad seek",
  "premature end of",
  "end of stream",
  "pixel limit",
  "not a known file format",
  "unable to decode",
];

function isInvalidImageProcessingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return INVALID_IMAGE_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function getResizeOptions(variant: UploadImageVariant) {
  return variant === "space_logo"
    ? {
        width: PROCESSED_SPACE_LOGO_SIZE,
        height: PROCESSED_SPACE_LOGO_SIZE,
        fit: "cover" as const,
        position: "centre" as const,
        withoutEnlargement: true,
      }
    : {
        width: PROCESSED_IMAGE_SIZE,
        height: PROCESSED_IMAGE_SIZE,
        fit: "contain" as const,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      };
}

function createImagePipeline(buffer: Buffer, animated = false) {
  return sharp(buffer, {
    limitInputPixels: UPLOAD_MAX_INPUT_PIXELS,
    sequentialRead: true,
    ...(animated ? { animated: true } : {}),
  });
}

async function fileExists(filepath: string): Promise<boolean> {
  return fs
    .access(filepath)
    .then(() => true)
    .catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    });
}

async function writeManagedUploadFile(
  filename: string,
  buffer: Buffer,
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const filepath = path.join(UPLOAD_DIR, filename);
  const tempFilepath = path.join(UPLOAD_DIR, `${filename}.${randomUUID()}.tmp`);
  const overwrite = options.overwrite ?? false;

  if (!overwrite && (await fileExists(filepath))) return;

  await fs.writeFile(tempFilepath, buffer);
  try {
    await fs.rename(tempFilepath, filepath);
  } finally {
    await fs.unlink(tempFilepath).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}

async function getImageFormat(buffer: Buffer): Promise<string | undefined> {
  const image = createImagePipeline(buffer, true);
  try {
    const metadata = await image.metadata();
    return metadata.format;
  } catch {
    throw new InvalidImageError();
  }
}

async function processGifPosterBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    // Decode as a still image to force first-frame poster output.
    return await createImagePipeline(buffer)
      .rotate()
      .resize(getResizeOptions("item"))
      .webp({ quality: PROCESSED_IMAGE_QUALITY })
      .toBuffer();
  } catch (error) {
    if (isInvalidImageProcessingError(error)) {
      throw new InvalidImageError();
    }
    throw error;
  }
}

export async function processImageBuffer(
  buffer: Buffer,
  variant: UploadImageVariant = "item",
): Promise<Buffer> {
  const image = createImagePipeline(buffer);

  try {
    await image.metadata();
  } catch {
    throw new InvalidImageError();
  }

  try {
    return await image
      .rotate()
      .resize(getResizeOptions(variant))
      .webp({ quality: PROCESSED_IMAGE_QUALITY })
      .toBuffer();
  } catch (error) {
    if (isInvalidImageProcessingError(error)) {
      throw new InvalidImageError();
    }
    throw error;
  }
}

export async function saveUploadedImage(
  buffer: Buffer,
  options: { variant?: UploadImageVariant } = {},
): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const variant = options.variant ?? "item";
  const format = await getImageFormat(buffer);

  if (variant === "item" && format?.toLowerCase() === "gif") {
    const hash = createHash("sha256").update(buffer).digest("hex");
    const gifFilename = `${hash}.gif`;
    const posterFilename = `${hash}.poster.webp`;

    await writeManagedUploadFile(gifFilename, buffer);
    const posterBuffer = await processGifPosterBuffer(buffer);
    await writeManagedUploadFile(posterFilename, posterBuffer, { overwrite: true });

    return `/uploads/${gifFilename}`;
  }

  const processedBuffer = await processImageBuffer(buffer, variant);
  const filename = `${createHash("sha256").update(processedBuffer).digest("hex")}.webp`;
  await writeManagedUploadFile(filename, processedBuffer);

  return `/uploads/${filename}`;
}
