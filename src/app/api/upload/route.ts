import { NextResponse } from "next/server";
import { badRequest, validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { takeRateLimitToken } from "@/lib/rate-limit";
import { InvalidImageError, saveUploadedImage } from "@/lib/upload";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_RATE_LIMIT_MAX_REQUESTS,
  UPLOAD_RATE_LIMIT_WINDOW_MS,
} from "@/lib/upload-config";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { cleanupUploadSchema } from "@/lib/validators";

export const POST = withHandler(async (request) => {
  const auth = await requireRequestAuth(request);
  const rateLimit = takeRateLimitToken({
    key: `upload:${auth.deviceId}`,
    maxRequests: UPLOAD_RATE_LIMIT_MAX_REQUESTS,
    windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a minute and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) badRequest("No file provided");
  if (file.size > UPLOAD_MAX_BYTES) badRequest("File too large (max 10MB)");

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await saveUploadedImage(buffer);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      badRequest(error.message);
    }
    throw error;
  }
});

export const DELETE = withHandler(async (request) => {
  await requireRequestAuth(request);
  const { imageUrl } = await validateBody(request, cleanupUploadSchema);

  await tryDeleteManagedUploadIfUnreferenced(imageUrl, "client upload cleanup");
  return new Response(null, { status: 204 });
});
