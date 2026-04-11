const dnsMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: dnsMocks.lookup,
}));

import {
  __clearSourcePreviewResolverCacheForTests,
  __getSourcePreviewResolverCacheSizeForTests,
  resolveSourcePreview,
} from "@/lib/source-preview-resolver";

describe("source preview resolver", () => {
  beforeEach(() => {
    __clearSourcePreviewResolverCacheForTests();
    dnsMocks.lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("returns native provider previews for YouTube", async () => {
    const result = await resolveSourcePreview("https://youtu.be/dQw4w9WgXcQ");
    expect(result.provider).toBe("YOUTUBE");
    expect(result.youtubeContentKind).toBe("VIDEO");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(result.embedType).toBe("iframe");
    expect(result.resolvedBy).toBe("native");
  });

  it("promotes watch URLs to Shorts when oEmbed reports portrait dimensions", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ width: 113, height: 200, thumbnail_url: "https://i.ytimg.com/hq2.jpg" }),
    } as unknown as Response);

    try {
      const result = await resolveSourcePreview(
        "https://www.youtube.com/watch?v=Jp46t341ijE",
        null,
        {
          detectYouTubeContentKind: true,
        },
      );
      expect(result.provider).toBe("YOUTUBE");
      expect(result.youtubeContentKind).toBe("SHORTS");
      expect(result.embedUrl).toBe("https://www.youtube.com/embed/Jp46t341ijE");
      expect(result.thumbnailUrl).toBe("https://i.ytimg.com/hq2.jpg");
      expect(result.resolvedBy).toBe("native");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves YouTube duration from watch page metadata when available", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ width: 200, height: 113, thumbnail_url: "https://i.ytimg.com/hq.jpg" }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<meta itemprop="duration" content="PT1M30S" /><script>var x={"lengthSeconds":"90"};</script>',
      } as unknown as Response);

    try {
      const result = await resolveSourcePreview(
        "https://www.youtube.com/watch?v=Jp46t341ijE",
        null,
        { detectYouTubeContentKind: true, includeYouTubeDuration: true },
      );
      expect(result.provider).toBe("YOUTUBE");
      expect(result.durationSec).toBe(90);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not fetch YouTube watch page when duration is not requested", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ width: 200, height: 113, thumbnail_url: "https://i.ytimg.com/hq.jpg" }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    try {
      const result = await resolveSourcePreview(
        "https://www.youtube.com/watch?v=Jp46t341ijE",
        null,
        { detectYouTubeContentKind: true, includeYouTubeDuration: false },
      );
      expect(result.provider).toBe("YOUTUBE");
      expect(result.durationSec).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns Spotify oEmbed metadata for title and thumbnail", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Uranium Heart",
        thumbnail_url: "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02139acc2cf55729a5991ef2bf",
      }),
    } as unknown as Response);

    try {
      const result = await resolveSourcePreview("https://open.spotify.com/track/5O9j5J7eMaBKHqNqupnu0i");
      expect(result.provider).toBe("SPOTIFY");
      expect(result.embedUrl).toBe("https://open.spotify.com/embed/track/5O9j5J7eMaBKHqNqupnu0i");
      expect(result.thumbnailUrl).toBe(
        "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02139acc2cf55729a5991ef2bf",
      );
      expect(result.title).toBe("Uranium Heart");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns native external embed for Vimeo", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "The Miracle",
        thumbnail_url: "https://i.vimeocdn.com/video/2129137440-b65534ce.jpg",
      }),
    } as unknown as Response);

    try {
      const result = await resolveSourcePreview("https://vimeo.com/123456789");
      expect(result.provider).toBeNull();
      expect(result.kind).toBe("VIMEO");
      expect(result.embedUrl).toBe("https://player.vimeo.com/video/123456789");
      expect(result.thumbnailUrl).toBe("https://i.vimeocdn.com/video/2129137440-b65534ce.jpg");
      expect(result.title).toBe("The Miracle");
      expect(result.resolvedBy).toBe("native");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses resolver and caches SoundCloud short-link previews", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html: '<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F42"></iframe>',
      }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    try {
      const first = await resolveSourcePreview("https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr");
      const second = await resolveSourcePreview("https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr");

      expect(first.kind).toBe("SOUNDCLOUD");
      expect(first.embedUrl).toContain("w.soundcloud.com/player/");
      expect(first.resolvedBy).toBe("resolver");
      expect(second.embedUrl).toBe(first.embedUrl);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns native preview for X status links and resolves title via oEmbed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        author_name: "Roundtable",
        html: "<blockquote><p>Hello from X message</p></blockquote>",
      }),
    } as unknown as Response);

    try {
      const result = await resolveSourcePreview("https://x.com/openai/status/1895463212345678901");
      expect(result.kind).toBe("X");
      expect(result.embedUrl).toBe(
        "https://platform.twitter.com/embed/Tweet.html?id=1895463212345678901&dnt=true",
      );
      expect(result.title).toBe("Hello from X message");
      expect(result.note).toBeNull();
      expect(result.resolvedBy).toBe("native");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves Instagram reel thumbnail from open graph metadata", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<meta property="og:title" content="Reel title" /><meta property="og:image" content="https://scontent.cdninstagram.com/reel.jpg?x=1&amp;y=2" />',
    } as unknown as Response);

    try {
      const result = await resolveSourcePreview("https://www.instagram.com/reel/DVfKzGbiDeA/");
      expect(result.kind).toBe("INSTAGRAM");
      expect(result.thumbnailUrl).toBe("https://scontent.cdninstagram.com/reel.jpg?x=1&y=2");
      expect(result.title).toBe("Reel title");
      expect(result.resolvedBy).toBe("native");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves generic link unfurl metadata from Open Graph tags", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () =>
        '<meta property="og:title" content="Article title" /><meta property="og:description" content="Quick summary" /><meta property="og:image" content="https://cdn.example.com/cover.jpg" /><meta property="og:site_name" content="Example News" />',
    } as unknown as Response);

    try {
      const result = await resolveSourcePreview("https://example.com/posts/123");
      expect(result.kind).toBe("GENERIC");
      expect(result.embedUrl).toBeNull();
      expect(result.title).toBe("Article title");
      expect(result.description).toBe("Quick summary");
      expect(result.thumbnailUrl).toBe("https://cdn.example.com/cover.jpg");
      expect(result.siteName).toBe("Example News");
      expect(result.note).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns a safe blocked payload for localhost/private preview URLs", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await resolveSourcePreview("http://127.0.0.1:8080/private");
      expect(result.provider).toBeNull();
      expect(result.embedUrl).toBeNull();
      expect(result.resolvedBy).toBe("none");
      expect(result.note).toBe("Preview blocked for local or private network URLs. Use Open source.");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("blocks redirects from public URLs to private-network targets", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1:9000/admin" },
      }),
    );
    globalThis.fetch = fetchMock;

    try {
      const result = await resolveSourcePreview("https://example.com/redirect-private");
      expect(result.embedUrl).toBeNull();
      expect(result.resolvedBy).toBe("none");
      expect(result.note).toBe("Preview blocked for local or private network URLs. Use Open source.");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("blocks hostname previews when DNS resolves to private addresses", async () => {
    dnsMocks.lookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await resolveSourcePreview("https://example.com/internal");
      expect(result.embedUrl).toBeNull();
      expect(result.resolvedBy).toBe("none");
      expect(result.note).toBe("Preview blocked for local or private network URLs. Use Open source.");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("allows public IPv6 literal URLs to resolve without policy block", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("<html><body>ok</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    try {
      const result = await resolveSourcePreview("http://[2606:4700:4700::1111]/");
      expect(result.note).not.toBe("Preview blocked for local or private network URLs. Use Open source.");
      expect(result.resolvedBy).toBe("none");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects unsafe SoundCloud oEmbed iframe hosts", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html: '<iframe src="https://evil.example/embed"></iframe>',
      }),
    } as unknown as Response);
    globalThis.fetch = fetchMock;

    try {
      const result = await resolveSourcePreview("https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr");
      expect(result.kind).toBe("SOUNDCLOUD");
      expect(result.embedUrl).toBeNull();
      expect(result.resolvedBy).toBe("none");
      expect(result.note).toBe(
        "Loading SoundCloud preview... If it does not appear, use Open source.",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back when SoundCloud oEmbed request times out", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        if (!signal) return;
        if (signal.aborted) {
          reject(new Error("aborted"));
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const resolutionPromise = resolveSourcePreview(
        "https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr",
      );
      await vi.advanceTimersByTimeAsync(4_100);
      const result = await resolutionPromise;
      expect(result.embedUrl).toBeNull();
      expect(result.resolvedBy).toBe("none");
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it("resolves TikTok short links through trusted redirects and returns embed URL", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.tiktok.com/@artist/video/7481928374655643001" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "Video title",
            thumbnail_url: "https://p19-common-sign.tiktokcdn-eu.com/video-thumb.jpeg",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock;

    try {
      const result = await resolveSourcePreview("https://vm.tiktok.com/ZMkw12345/");
      expect(result.kind).toBe("TIKTOK");
      expect(result.embedUrl).toBe(
        "https://www.tiktok.com/player/v1/7481928374655643001?autoplay=1&loop=1&description=0&music_info=0&rel=0",
      );
      expect(result.thumbnailUrl).toBe("https://p19-common-sign.tiktokcdn-eu.com/video-thumb.jpeg");
      expect(result.title).toBe("Video title");
      expect(result.resolvedBy).toBe("resolver");
      expect(result.note).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects TikTok redirects to non-TikTok hosts", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/not-tiktok" },
      }),
    );
    globalThis.fetch = fetchMock;

    try {
      const result = await resolveSourcePreview("https://vm.tiktok.com/ZMkw12345/");
      expect(result.kind).toBe("TIKTOK");
      expect(result.embedUrl).toBeNull();
      expect(result.resolvedBy).toBe("none");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("bounds cache growth for high-cardinality URLs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      headers: { get: () => "text/html" },
      text: async () => "",
    } as unknown as Response);
    try {
      for (let index = 0; index < 700; index += 1) {
        await resolveSourcePreview(`https://example.com/resource/${index}`);
      }
      expect(__getSourcePreviewResolverCacheSizeForTests()).toBeLessThanOrEqual(500);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

