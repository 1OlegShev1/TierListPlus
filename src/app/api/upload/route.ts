import { NextResponse } from "next/server";
import { badRequest, withHandler } from "@/lib/api-helpers";
import { saveUploadedImage, validateImageBuffer } from "@/lib/upload";
import { UPLOAD_MAX_BYTES } from "@/lib/upload-config";

export const POST = withHandler(async (request) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) badRequest("No file provided");
  if (!file.type.startsWith("image/")) badRequest("File must be an image");
  if (file.size > UPLOAD_MAX_BYTES) badRequest("File too large (max 10MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateImageBuffer(buffer)) badRequest("File is not a valid image");

  try {
    const url = await saveUploadedImage(buffer);
    return NextResponse.json({ url });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      throw error;
    }

    badRequest("Could not process image");
  }
});
