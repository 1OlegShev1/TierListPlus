const mocks = vi.hoisted(() => ({
  processImageBuffer: vi.fn(),
  saveUploadedImage: vi.fn(),
}));

vi.mock("@/lib/upload", () => ({
  processImageBuffer: mocks.processImageBuffer,
  saveUploadedImage: mocks.saveUploadedImage,
}));

import { resolveItemImageUrlForCreate } from "@/lib/item-image-storage";

const YOUTUBE_SOURCE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const YOUTUBE_THUMBNAIL_URL = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";

describe("item image storage", () => {
  beforeEach(() => {
    mocks.processImageBuffer.mockReset();
    mocks.saveUploadedImage.mockReset();
  });

  it("returns existing managed uploads unchanged", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();

    try {
      const result = await resolveItemImageUrlForCreate(
        "/uploads/existing.webp",
        YOUTUBE_SOURCE_URL,
      );
      expect(result).toBe("/uploads/existing.webp");
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mocks.saveUploadedImage).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("persists eligible remote thumbnails into managed uploads", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "3",
        },
      }),
    );
    mocks.saveUploadedImage.mockResolvedValue("/uploads/managed-thumb.webp");

    try {
      const result = await resolveItemImageUrlForCreate(YOUTUBE_THUMBNAIL_URL, YOUTUBE_SOURCE_URL);
      expect(result).toBe("/uploads/managed-thumb.webp");
      expect(globalThis.fetch).toHaveBeenCalledWith(YOUTUBE_THUMBNAIL_URL, expect.any(Object));
      expect(mocks.saveUploadedImage).toHaveBeenCalledTimes(1);
      expect(mocks.processImageBuffer).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stores direct gif URLs as still thumbnails", async () => {
    const originalFetch = globalThis.fetch;
    const gifSourceUrl = "https://media4.giphy.com/media/abc123/giphy.gif";
    const processedBuffer = Buffer.from([9, 9, 9]);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/gif",
          "content-length": "3",
        },
      }),
    );
    mocks.processImageBuffer.mockResolvedValue(processedBuffer);
    mocks.saveUploadedImage.mockResolvedValue("/uploads/still-thumb.webp");

    try {
      const result = await resolveItemImageUrlForCreate(gifSourceUrl, gifSourceUrl);
      expect(result).toBe("/uploads/still-thumb.webp");
      expect(mocks.processImageBuffer).toHaveBeenCalledTimes(1);
      expect(mocks.saveUploadedImage).toHaveBeenCalledWith(processedBuffer, { variant: "item" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("skips ingestion for untrusted thumbnail hosts", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();

    try {
      const result = await resolveItemImageUrlForCreate(
        "https://evil.example/thumb.jpg",
        YOUTUBE_SOURCE_URL,
      );
      expect(result).toBe("https://evil.example/thumb.jpg");
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mocks.saveUploadedImage).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("skips ingestion for deceptive hosts that only contain trusted substrings", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();

    try {
      const deceptiveUrl = "https://tiktokcdn.attacker.example/thumb.jpg";
      const result = await resolveItemImageUrlForCreate(deceptiveUrl, YOUTUBE_SOURCE_URL);
      expect(result).toBe(deceptiveUrl);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mocks.saveUploadedImage).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("skips ingestion for non-https thumbnail URLs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();

    try {
      const httpThumbnailUrl = "http://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
      const result = await resolveItemImageUrlForCreate(httpThumbnailUrl, YOUTUBE_SOURCE_URL);
      expect(result).toBe(httpThumbnailUrl);
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(mocks.saveUploadedImage).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to original URL when remote download fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network fail"));

    try {
      const result = await resolveItemImageUrlForCreate(YOUTUBE_THUMBNAIL_URL, YOUTUBE_SOURCE_URL);
      expect(result).toBe(YOUTUBE_THUMBNAIL_URL);
      expect(mocks.saveUploadedImage).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
