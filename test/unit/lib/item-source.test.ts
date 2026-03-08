import {
  buildExternalSourceEmbedUrl,
  buildYouTubeEmbedUrl,
  detectExternalSourceKind,
  getExternalSourceKindLabel,
  INVALID_ITEM_SOURCE_MESSAGE,
  MAX_SOURCE_INTERVAL_SECONDS,
  normalizeItemSourceNote,
  parseAnyItemSource,
  parseSupportedItemSource,
  resolveItemSourceForWrite,
  resolveSourceIntervalForWrite,
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
      youtubeContentKind: "VIDEO",
    });
  });

  it("preserves YouTube Shorts links as shorts and tags content kind", () => {
    const parsed = parseSupportedItemSource("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(parsed).toEqual({
      provider: "YOUTUBE",
      normalizedUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      youtubeVideoId: "dQw4w9WgXcQ",
      youtubeContentKind: "SHORTS",
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
      youtubeContentKind: null,
    });
  });

  it("accepts generic external providers", () => {
    expect(resolveItemSourceForWrite("https://example.com/video")).toEqual({
      sourceUrl: "https://example.com/video",
      sourceProvider: null,
    });
  });

  it("rejects invalid source URLs", () => {
    expect(() => resolveItemSourceForWrite("javascript:alert(1)")).toThrow(
      INVALID_ITEM_SOURCE_MESSAGE,
    );
  });

  it("parses generic links with null provider metadata", () => {
    const parsed = parseAnyItemSource("https://example.com/video");
    expect(parsed).toEqual({
      provider: null,
      normalizedUrl: "https://example.com/video",
      embedUrl: null,
      thumbnailUrl: null,
      youtubeVideoId: null,
      youtubeContentKind: null,
    });
  });

  it("detects and builds Vimeo embeds", () => {
    expect(detectExternalSourceKind("https://vimeo.com/123456789")).toBe("VIMEO");
    expect(buildExternalSourceEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
    expect(getExternalSourceKindLabel("VIMEO")).toBe("Vimeo");
  });

  it("detects and builds SoundCloud embeds", () => {
    expect(detectExternalSourceKind("https://soundcloud.com/artist/track-name")).toBe("SOUNDCLOUD");
    expect(detectExternalSourceKind("https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr")).toBe(
      "SOUNDCLOUD",
    );
    expect(buildExternalSourceEmbedUrl("https://soundcloud.com/artist/track-name")).toContain(
      "w.soundcloud.com/player/",
    );
    expect(buildExternalSourceEmbedUrl("https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr")).toBeNull();
  });

  it("detects Twitch and requires parent hostname for embeds", () => {
    expect(detectExternalSourceKind("https://www.twitch.tv/videos/2211037881")).toBe("TWITCH");
    expect(buildExternalSourceEmbedUrl("https://www.twitch.tv/videos/2211037881")).toBeNull();
    expect(
      buildExternalSourceEmbedUrl("https://www.twitch.tv/videos/2211037881", "localhost"),
    ).toContain("player.twitch.tv");
    expect(
      buildExternalSourceEmbedUrl(
        "https://www.twitch.tv/somechannel/clip/FancyClipSlug",
        "localhost",
      ),
    ).toContain("clips.twitch.tv/embed?clip=FancyClipSlug");
  });

  it("detects direct media types", () => {
    expect(detectExternalSourceKind("https://cdn.example.com/clip.mp4")).toBe("VIDEO");
    expect(detectExternalSourceKind("https://cdn.example.com/audio.mp3")).toBe("AUDIO");
    expect(detectExternalSourceKind("https://cdn.example.com/image.webp")).toBe("IMAGE");
    expect(detectExternalSourceKind("https://cdn.example.com/file.pdf")).toBe("PDF");
  });

  it("detects problematic social hosts as external kinds", () => {
    expect(detectExternalSourceKind("https://x.com/user/status/1")).toBe("X");
    expect(buildExternalSourceEmbedUrl("https://x.com/user/status/1895463212345678901")).toBe(
      "https://platform.twitter.com/embed/Tweet.html?id=1895463212345678901&dnt=true",
    );
    expect(detectExternalSourceKind("https://www.facebook.com/story.php?story_fbid=1&id=2")).toBe(
      "FACEBOOK",
    );
    expect(detectExternalSourceKind("https://www.instagram.com/p/abc123")).toBe("INSTAGRAM");
    expect(buildExternalSourceEmbedUrl("https://www.instagram.com/p/C6K7Xx1Sabc/")).toBe(
      "https://www.instagram.com/p/C6K7Xx1Sabc/embed",
    );
    expect(buildExternalSourceEmbedUrl("https://www.instagram.com/reel/DUGPTUUjFx0/")).toBe(
      "https://www.instagram.com/reel/DUGPTUUjFx0/embed?autoplay=1",
    );
    expect(detectExternalSourceKind("https://www.tiktok.com/@user/video/1")).toBe("TIKTOK");
    expect(
      buildExternalSourceEmbedUrl("https://www.tiktok.com/@artist/video/7481928374655643001"),
    ).toBe(
      "https://www.tiktok.com/player/v1/7481928374655643001?autoplay=1&loop=1&description=0&music_info=0&rel=0",
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
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ", null, null, "SHORTS")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ&playsinline=1",
    );
  });
});
