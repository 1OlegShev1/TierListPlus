import sharp from "sharp";
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

  it("keeps full space logos with transparent padding instead of center-cropping", async () => {
    const wideLogo = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="#ff0000"/></svg>',
      "utf8",
    );

    const processed = await processImageBuffer(wideLogo, "space_logo");
    const metadata = await sharp(processed).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);

    const topLeft = await sharp(processed)
      .ensureAlpha()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    const center = await sharp(processed)
      .ensureAlpha()
      .extract({ left: 128, top: 128, width: 1, height: 1 })
      .raw()
      .toBuffer();

    expect(topLeft[3]).toBe(0);
    expect(center[3]).toBe(255);
  });
});
