// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";

describe("ItemArtwork", () => {
  it("uses cover rendering by default", () => {
    const { container } = render(<ItemArtwork src="/img/rust.webp" alt="Rust" />);

    const images = container.querySelectorAll("img");

    expect(images).toHaveLength(1);
    expect(screen.getByAltText("Rust")).toBe(images[0]);
    expect(images[0]?.className).toContain("object-cover");
  });

  it("uses the ambient renderer only when explicitly requested", () => {
    const { container } = render(
      <ItemArtwork src="/img/rust.webp" alt="Rust" presentation="ambient" inset="compact" />,
    );

    const images = container.querySelectorAll("img");

    expect(images).toHaveLength(2);
    expect(screen.getByAltText("Rust")).toBe(images[1]);
    expect(images[1]?.className).toContain("object-contain");
    expect(images[1]?.className).toContain("p-[4%]");
  });
});
