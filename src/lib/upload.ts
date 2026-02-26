import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { nanoid } from "nanoid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedImage(file: File): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const ext = ".webp";
  const filename = `${nanoid()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());

  await sharp(buffer)
    .resize(200, 200, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(filepath);

  return `/uploads/${filename}`;
}
