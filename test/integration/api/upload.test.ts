import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { processImageBuffer } from "@/lib/upload";

const mocks = vi.hoisted(() => ({
  requireRequestAuth: vi.fn(),
  takeRateLimitToken: vi.fn(),
  tryDeleteManagedUploadIfUnreferenced: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  takeRateLimitToken: mocks.takeRateLimitToken,
}));

vi.mock("@/lib/upload-gc", () => ({
  tryDeleteManagedUploadIfUnreferenced: mocks.tryDeleteManagedUploadIfUnreferenced,
}));

import { DELETE, POST } from "@/app/api/upload/route";
import { routeCtx } from "../../helpers/request";

function uploadRequest(file: File): Request {
  const formData = new FormData();
  formData.append("file", file);
  return new Request("https://example.test/api/upload", {
    method: "POST",
    body: formData,
  });
}

function uploadPathFromUrl(url: string): string {
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

async function getExpectedUploadPath(
  file: File,
): Promise<{ filepath: string; existedBefore: boolean }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processImageBuffer(buffer);
  const filename = `${createHash("sha256").update(processed).digest("hex")}.webp`;
  const filepath = path.join(process.cwd(), "public", "uploads", filename);
  const existedBefore = await fs
    .access(filepath)
    .then(() => true)
    .catch(() => false);

  return { filepath, existedBefore };
}

describe("upload route", () => {
  const createdFiles = new Set<string>();

  beforeEach(() => {
    mocks.requireRequestAuth.mockReset().mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
    });
    mocks.takeRateLimitToken.mockReset().mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mocks.tryDeleteManagedUploadIfUnreferenced.mockReset().mockResolvedValue(true);
  });

  afterEach(async () => {
    await Promise.all(Array.from(createdFiles, (filepath) => fs.unlink(filepath).catch(() => {})));
    createdFiles.clear();
  });

  it("requires an authenticated identity", async () => {
    mocks.requireRequestAuth.mockRejectedValueOnce({
      status: 401,
      details: "User identity required",
    });

    const response = await POST(
      uploadRequest(new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" })),
      routeCtx({}),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "User identity required" });
    expect(mocks.takeRateLimitToken).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mocks.takeRateLimitToken.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 42,
    });

    const response = await POST(
      uploadRequest(new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" })),
      routeCtx({}),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toEqual({
      error: "Too many uploads. Please wait a minute and try again.",
    });
  });

  it("returns 400 for invalid image payloads", async () => {
    const response = await POST(
      uploadRequest(new File(["not-an-image"], "broken.bin", { type: "" })),
      routeCtx({}),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "File is not a valid image" });
  });

  it("returns 400 for corrupt image payloads", async () => {
    const basePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pF1EAAAAASUVORK5CYII=",
      "base64",
    );
    const truncatedPng = basePng.subarray(0, 50);

    const response = await POST(
      uploadRequest(new File([truncatedPng], "broken.png", { type: "image/png" })),
      routeCtx({}),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "File is not a valid image" });
  });

  it("uploads an authenticated SVG payload using the real processing path", async () => {
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17"></svg>'],
      "icon.svg",
      { type: "image/svg+xml" },
    );
    const { filepath, existedBefore } = await getExpectedUploadPath(file);

    const response = await POST(uploadRequest(file), routeCtx({}));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      url: expect.stringMatching(/^\/uploads\/[a-f0-9]+\.webp$/),
    });

    expect(uploadPathFromUrl(body.url)).toBe(filepath);
    if (!existedBefore) {
      createdFiles.add(filepath);
    }
    await expect(fs.readFile(filepath)).resolves.toBeInstanceOf(Buffer);
    expect(mocks.takeRateLimitToken).toHaveBeenCalledWith({
      key: "upload:device_1",
      maxRequests: 120,
      windowMs: 60_000,
    });
  });

  it("returns 500 for unexpected storage failures", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fs, "writeFile").mockRejectedValueOnce(new Error("disk full"));

    const response = await POST(
      uploadRequest(
        new File(
          ['<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19"></svg>'],
          "icon.svg",
          { type: "image/svg+xml" },
        ),
      ),
      routeCtx({}),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("cleans up an abandoned uploaded file", async () => {
    const response = await DELETE(
      new Request("https://example.test/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: "/uploads/abc123.webp" }),
      }),
      routeCtx({}),
    );

    expect(response.status).toBe(204);
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/uploads/abc123.webp",
      "client upload cleanup",
    );
  });
});
