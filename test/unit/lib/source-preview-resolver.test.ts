import {
  __clearSourcePreviewResolverCacheForTests,
  __getSourcePreviewResolverCacheSizeForTests,
  resolveSourcePreview,
} from "@/lib/source-preview-resolver";

describe("source preview resolver", () => {
  beforeEach(() => {
    __clearSourcePreviewResolverCacheForTests();
  });

  it("returns native provider previews for YouTube", async () => {
    const result = await resolveSourcePreview("https://youtu.be/dQw4w9WgXcQ");
    expect(result.provider).toBe("YOUTUBE");
    expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result.embedType).toBe("iframe");
    expect(result.resolvedBy).toBe("native");
  });

  it("returns native external embed for Vimeo", async () => {
    const result = await resolveSourcePreview("https://vimeo.com/123456789");
    expect(result.provider).toBeNull();
    expect(result.kind).toBe("VIMEO");
    expect(result.embedUrl).toBe("https://player.vimeo.com/video/123456789");
    expect(result.resolvedBy).toBe("native");
  });

  it("uses resolver and caches SoundCloud short-link previews", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html: '<iframe src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F42"></iframe>',
      }),
    } as Response);
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

  it("returns native preview for X status links", async () => {
    const result = await resolveSourcePreview("https://x.com/openai/status/1895463212345678901");
    expect(result.kind).toBe("X");
    expect(result.embedUrl).toBe(
      "https://platform.twitter.com/embed/Tweet.html?id=1895463212345678901&dnt=true",
    );
    expect(result.note).toBeNull();
    expect(result.resolvedBy).toBe("native");
  });

  it("rejects unsafe SoundCloud oEmbed iframe hosts", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html: '<iframe src="https://evil.example/embed"></iframe>',
      }),
    } as Response);
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
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;

    try {
      const result = await resolveSourcePreview("https://vm.tiktok.com/ZMkw12345/");
      expect(result.kind).toBe("TIKTOK");
      expect(result.embedUrl).toBe(
        "https://www.tiktok.com/player/v1/7481928374655643001?autoplay=1&loop=1&description=0&music_info=0&rel=0",
      );
      expect(result.resolvedBy).toBe("resolver");
      expect(result.note).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
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
    for (let index = 0; index < 700; index += 1) {
      await resolveSourcePreview(`https://example.com/resource/${index}`);
    }
    expect(__getSourcePreviewResolverCacheSizeForTests()).toBeLessThanOrEqual(500);
  });
});
