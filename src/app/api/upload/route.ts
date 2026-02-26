import { NextResponse } from "next/server";
import { badRequest, withHandler } from "@/lib/api-helpers";
import { saveUploadedImage } from "@/lib/upload";

export const POST = withHandler(async (request) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) badRequest("No file provided");
  if (!file.type.startsWith("image/")) badRequest("File must be an image");
  if (file.size > 10 * 1024 * 1024) badRequest("File too large (max 10MB)");

  const url = await saveUploadedImage(file);
  return NextResponse.json({ url });
});
