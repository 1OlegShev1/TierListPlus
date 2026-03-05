import { getStaticArtworkSrc, isAnimatedImageUrl } from "@/lib/media";
import {
  extractManagedUploadFilename,
  extractManagedWebpUploadFilename,
  getCompanionUploadFilenames,
} from "@/lib/uploads";

describe("uploads helpers", () => {
  it("extracts managed upload filenames for webp and gif", () => {
    expect(extractManagedUploadFilename("/uploads/abc123.webp")).toBe("abc123.webp");
    expect(extractManagedUploadFilename("/uploads/abc123.gif")).toBe("abc123.gif");
    expect(extractManagedUploadFilename("/uploads/abc123.poster.webp")).toBeNull();
    expect(extractManagedWebpUploadFilename("/uploads/abc123.webp")).toBe("abc123.webp");
    expect(extractManagedWebpUploadFilename("/uploads/abc123.gif")).toBeNull();
  });

  it("resolves gif companion filenames", () => {
    expect(getCompanionUploadFilenames("abc123.gif")).toEqual(["abc123.poster.webp"]);
    expect(getCompanionUploadFilenames("abc123.webp")).toEqual([]);
    expect(getCompanionUploadFilenames("abc123.poster.webp")).toEqual([]);
  });
});

describe("media helpers", () => {
  it("detects animated image urls", () => {
    expect(isAnimatedImageUrl("/uploads/abc123.gif")).toBe(true);
    expect(isAnimatedImageUrl("/uploads/abc123.webp")).toBe(false);
  });

  it("maps managed gif uploads to static poster urls", () => {
    expect(getStaticArtworkSrc("/uploads/abc123.gif")).toBe("/uploads/abc123.poster.webp");
    expect(getStaticArtworkSrc("/uploads/abc123.gif?v=1")).toBe(
      "/uploads/abc123.poster.webp?v=1",
    );
    expect(getStaticArtworkSrc("/uploads/abc123.webp")).toBe("/uploads/abc123.webp");
    expect(getStaticArtworkSrc("https://cdn.example.com/cat.gif")).toBe(
      "https://cdn.example.com/cat.gif",
    );
  });
});
