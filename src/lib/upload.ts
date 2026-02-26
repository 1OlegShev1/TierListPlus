import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import sharp from "sharp";

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

  const ext = ".webp";
  const filename = `${nanoid()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await sharp(buffer).resize(200, 200, { fit: "cover" }).webp({ quality: 80 }).toFile(filepath);

  return `/uploads/${filename}`;
}
