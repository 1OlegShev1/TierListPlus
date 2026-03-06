import {
  buildYouTubeEmbedUrl,
  MAX_SOURCE_INTERVAL_SECONDS,
  normalizeItemSourceNote,
  parseSupportedItemSource,
  resolveSourceIntervalForWrite,
  resolveItemSourceForWrite,
  UNSUPPORTED_ITEM_SOURCE_MESSAGE,
} from "@/lib/item-source";

describe("item source utils", () => {
  it("parses YouTube watch links and normalizes to canonical URLs", () => {
    const parsed = parseSupportedItemSource("https://youtu.be/dQw4w9WgXcQ?t=43");

    expect(parsed).toEqual({
      provider: "YOUTUBE",
      normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      youtubeVideoId: "dQw4w9WgXcQ",
    });
  });

  it("parses Spotify links and strips query params", () => {
    const parsed = parseSupportedItemSource(
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123",
    );

    expect(parsed).toEqual({
      provider: "SPOTIFY",
      normalizedUrl: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      embedUrl: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
      thumbnailUrl: null,
      youtubeVideoId: null,
    });
  });

  it("rejects unsupported providers", () => {
    expect(() => resolveItemSourceForWrite("https://example.com/video")).toThrow(
      UNSUPPORTED_ITEM_SOURCE_MESSAGE,
    );
  });

  it("clears source fields when URL is null/blank", () => {
    expect(resolveItemSourceForWrite(null)).toEqual({ sourceUrl: null, sourceProvider: null });
    expect(resolveItemSourceForWrite("   ")).toEqual({ sourceUrl: null, sourceProvider: null });
  });

  it("normalizes optional source notes", () => {
    expect(normalizeItemSourceNote(undefined)).toBeUndefined();
    expect(normalizeItemSourceNote(null)).toBeNull();
    expect(normalizeItemSourceNote("   ")).toBeNull();
    expect(normalizeItemSourceNote("  live version  ")).toBe("live version");
  });

  it("normalizes intervals for YouTube", () => {
    expect(resolveSourceIntervalForWrite("YOUTUBE", 15, 45)).toEqual({
      sourceStartSec: 15,
      sourceEndSec: 45,
    });
  });

  it("clears explicit null intervals for non-YouTube providers", () => {
    expect(resolveSourceIntervalForWrite("SPOTIFY", null, null)).toEqual({
      sourceStartSec: null,
      sourceEndSec: null,
    });
  });

  it("rejects non-YouTube numeric interval inputs", () => {
    expect(() => resolveSourceIntervalForWrite("SPOTIFY", 10, null)).toThrow(
      "Source intervals are only supported for YouTube links.",
    );
  });

  it("rejects invalid YouTube ranges", () => {
    expect(() => resolveSourceIntervalForWrite("YOUTUBE", 30, 30)).toThrow(
      "End time must be greater than start time.",
    );
  });

  it("rejects intervals beyond integer bounds", () => {
    expect(() =>
      resolveSourceIntervalForWrite("YOUTUBE", MAX_SOURCE_INTERVAL_SECONDS + 1, null),
    ).toThrow(`Time must be less than or equal to ${MAX_SOURCE_INTERVAL_SECONDS} seconds.`);
  });

  it("builds YouTube embed URLs with optional interval params", () => {
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ", 12, 45)).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?start=12&end=45",
    );
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ", null, null)).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });
});
