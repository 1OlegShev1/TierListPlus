// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { ListDetailItemsGrid } from "@/components/templates/ListDetailItemsGrid";

vi.mock("@/components/items/source-modal/ItemSourceModal", () => ({
  ItemSourceModal: ({ itemLabel }: { itemLabel: string }) => (
    <div role="dialog">Source for {itemLabel}</div>
  ),
}));

vi.mock("@/components/ui/ItemArtwork", () => ({
  ItemArtwork: ({ alt, animate }: { alt: string; animate?: boolean }) => (
    <div data-animate={animate ? "true" : "false"}>{alt}</div>
  ),
}));

const items = [
  {
    id: "item_1",
    label: "Alpha",
    imageUrl: "/img/a.webp",
    sourceUrl: "https://example.com/alpha",
    sourceProvider: null,
    sourceNote: null,
    sourceStartSec: null,
    sourceEndSec: null,
  },
  {
    id: "item_2",
    label: "Beta",
    imageUrl: "/img/b.webp",
    sourceUrl: null,
    sourceProvider: null,
    sourceNote: null,
    sourceStartSec: null,
    sourceEndSec: null,
  },
];

describe("ListDetailItemsGrid", () => {
  it("focuses linked items on single click", () => {
    render(<ListDetailItemsGrid items={items} />);

    const alphaButton = screen.getByRole("button", { name: "Focus source item Alpha" });
    const alphaCard = alphaButton.closest("div");
    if (!alphaCard) throw new Error("Expected Alpha card");

    fireEvent.click(alphaButton);

    expect(alphaCard.className).toContain("border-[var(--accent-primary-hover)]");
    expect(alphaButton.querySelector("[data-animate]")?.getAttribute("data-animate")).toBe("true");
  });

  it("previews animation without source focus on unlinked read-only items", () => {
    render(<ListDetailItemsGrid items={items} />);

    const betaButton = screen.getByRole("button", { name: "Beta" });
    const betaCard = betaButton.closest("div");
    if (!betaCard) throw new Error("Expected Beta card");

    fireEvent.click(betaButton);
    fireEvent.doubleClick(betaButton);

    expect(betaCard.className).not.toContain("border-[var(--accent-primary-hover)]");
    expect(betaButton.querySelector("[data-animate]")?.getAttribute("data-animate")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens source details from double-click on linked items", () => {
    render(<ListDetailItemsGrid items={items} />);
    const alphaButton = screen.getByRole("button", { name: "Focus source item Alpha" });
    const alphaCard = alphaButton.closest("div");
    if (!alphaCard) throw new Error("Expected Alpha card");

    fireEvent.doubleClick(alphaButton);

    expect(alphaCard.className).toContain("border-[var(--accent-primary-hover)]");
    expect(alphaButton.querySelector("[data-animate]")?.getAttribute("data-animate")).toBe("true");
    expect(screen.getByRole("dialog").textContent).toBe("Source for Alpha");
  });

  it("keeps focus after touch double-tap opens source details", () => {
    render(<ListDetailItemsGrid items={items} />);
    const alphaButton = screen.getByRole("button", { name: "Focus source item Alpha" });
    const alphaCard = alphaButton.closest("div");
    if (!alphaCard) throw new Error("Expected Alpha card");

    fireEvent.pointerUp(alphaButton, { pointerType: "touch", timeStamp: 100 });
    fireEvent.click(alphaButton);
    fireEvent.pointerUp(alphaButton, { pointerType: "touch", timeStamp: 250 });
    fireEvent.click(alphaButton);

    expect(alphaCard.className).toContain("border-[var(--accent-primary-hover)]");
    expect(screen.getByRole("dialog").textContent).toBe("Source for Alpha");
  });
});
