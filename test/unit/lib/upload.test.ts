import { InvalidImageError, processImageBuffer } from "@/lib/upload";

describe("processImageBuffer", () => {
  it("accepts SVG buffers", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"></svg>',
      "utf8",
    );

    await expect(processImageBuffer(svg)).resolves.toBeInstanceOf(Buffer);
  });

  it("rejects non-image buffers", async () => {
    const text = Buffer.from("not an image", "utf8");

    await expect(processImageBuffer(text)).rejects.toBeInstanceOf(InvalidImageError);
  });
});
