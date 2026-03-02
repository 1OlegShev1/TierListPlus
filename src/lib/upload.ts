import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PROCESSED_IMAGE_QUALITY, PROCESSED_IMAGE_SIZE } from "@/lib/upload-config";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Known image format magic bytes: [signature, offset] */
const IMAGE_SIGNATURES: [number[], number][] = [
  [[0xff, 0xd8, 0xff], 0], // JPEG
  [[0x89, 0x50, 0x4e, 0x47], 0], // PNG
  [[0x47, 0x49, 0x46], 0], // GIF
  [[0x42, 0x4d], 0], // BMP
];

function isImageBuffer(buffer: Buffer): boolean {
  // WebP: RIFF header at offset 0 + "WEBP" at offset 8
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }
  return IMAGE_SIGNATURES.some(([sig, offset]) =>
    sig.every((byte, i) => buffer[offset + i] === byte),
  );
}

export function validateImageBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && isImageBuffer(buffer);
}

export async function saveUploadedImage(buffer: Buffer): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const processedBuffer = await sharp(buffer)
    .rotate()
    .resize(PROCESSED_IMAGE_SIZE, PROCESSED_IMAGE_SIZE, { fit: "cover" })
    .webp({ quality: PROCESSED_IMAGE_QUALITY })
    .toBuffer();

  const filename = `${createHash("sha256").update(processedBuffer).digest("hex")}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(filepath, processedBuffer, { flag: "wx" }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  });

  return `/uploads/${filename}`;
}
