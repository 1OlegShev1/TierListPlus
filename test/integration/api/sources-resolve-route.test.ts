const mocks = vi.hoisted(() => ({
  takeRateLimitToken: vi.fn(),
  resolveSourcePreview: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  takeRateLimitToken: mocks.takeRateLimitToken,
}));

vi.mock("@/lib/source-preview-resolver", () => ({
  resolveSourcePreview: mocks.resolveSourcePreview,
}));

import { GET } from "@/app/api/sources/resolve/route";

describe("sources resolve route", () => {
  beforeEach(() => {
    mocks.takeRateLimitToken.mockReset().mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mocks.resolveSourcePreview.mockReset();
  });

  it("returns 400 when url query is missing", async () => {
    const response = await GET(new Request("https://example.test/api/sources/resolve"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Enter a valid http(s) URL." });
    expect(mocks.resolveSourcePreview).not.toHaveBeenCalled();
  });

  it("returns 400 when url query exceeds supported length", async () => {
    const tooLongUrl = `https://example.com/${"a".repeat(600)}`;
    const response = await GET(
      new Request(`https://example.test/api/sources/resolve?url=${encodeURIComponent(tooLongUrl)}`),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Enter a valid http(s) URL." });
    expect(mocks.resolveSourcePreview).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exhausted", async () => {
    mocks.takeRateLimitToken.mockReturnValue({ allowed: false, retryAfterSeconds: 17 });

    const response = await GET(
      new Request("https://example.test/api/sources/resolve?url=https%3A%2F%2Fexample.com"),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: "Too many source preview requests. Please try again in a minute.",
    });
    expect(mocks.resolveSourcePreview).not.toHaveBeenCalled();
  });

  it("returns resolved preview payload when successful", async () => {
    const resolvedPayload = {
      sourceUrl: "https://example.com",
      provider: null,
      youtubeContentKind: null,
      durationSec: null,
      kind: "GENERIC",
      label: "External link",
      embedUrl: null,
      embedType: null,
      thumbnailUrl: null,
      title: null,
      note: "No inline preview for this link type yet.",
      resolvedBy: "none",
    };
    mocks.resolveSourcePreview.mockResolvedValue(resolvedPayload);

    const sourceUrl = "https://example.com";
    const response = await GET(
      new Request(
        `https://example.test/api/sources/resolve?url=${encodeURIComponent(sourceUrl)}&parent=app.example.com`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    await expect(response.json()).resolves.toEqual(resolvedPayload);
    expect(mocks.resolveSourcePreview).toHaveBeenCalledWith(sourceUrl, "app.example.com", {
      detectYouTubeContentKind: true,
      includeYouTubeDuration: false,
    });
  });

  it("returns 400 when resolver throws", async () => {
    mocks.resolveSourcePreview.mockRejectedValue(new Error("boom"));

    const response = await GET(
      new Request("https://example.test/api/sources/resolve?url=https%3A%2F%2Fexample.com"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Enter a valid http(s) URL." });
  });
});
