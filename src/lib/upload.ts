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

export async function processImageBuffer(
  buffer: Buffer,
  variant: UploadImageVariant = "item",
): Promise<Buffer> {
  const image = sharp(buffer, {
    limitInputPixels: UPLOAD_MAX_INPUT_PIXELS,
    sequentialRead: true,
  });

  try {
    await image.metadata();
  } catch {
    throw new InvalidImageError();
  }

  try {
    const resizeOptions =
      variant === "space_logo"
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

    return await image
      .rotate()
      .resize(resizeOptions)
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

  const processedBuffer = await processImageBuffer(buffer, options.variant ?? "item");

  const filename = `${createHash("sha256").update(processedBuffer).digest("hex")}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const tempFilepath = path.join(UPLOAD_DIR, `${filename}.${randomUUID()}.tmp`);

  const fileExists = await fs
    .access(filepath)
    .then(() => true)
    .catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    });

  if (!fileExists) {
    await fs.writeFile(tempFilepath, processedBuffer);
    try {
      await fs.rename(tempFilepath, filepath);
    } finally {
      await fs.unlink(tempFilepath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
  }

  return `/uploads/${filename}`;
}
