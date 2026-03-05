import fs from "node:fs/promises";
import path from "node:path";
import { MANAGED_UPLOAD_FILE_RE } from "@/lib/uploads";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    if (!MANAGED_UPLOAD_FILE_RE.test(filename)) {
      return new Response("Not found", { status: 404 });
    }

    const uploadRoot = path.resolve(UPLOAD_DIR);
    const filepath = path.resolve(uploadRoot, filename);
    const relative = path.relative(uploadRoot, filepath);

    // Block path traversal and absolute path escapes.
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return new Response("Not found", { status: 404 });
    }

    const file = await fs.readFile(filepath);
    const contentType = filename.toLowerCase().endsWith(".gif") ? "image/gif" : "image/webp";
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
