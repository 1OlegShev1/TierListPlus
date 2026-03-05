// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MatchupVoter } from "@/components/bracket/MatchupVoter";

describe("MatchupVoter", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(hover: hover) and (pointer: fine)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("animates gif item on hover and returns to static on leave", () => {
    render(
      <MatchupVoter
        itemA={{ id: "a", label: "Cat", imageUrl: "/uploads/cat.gif" }}
        itemB={{ id: "b", label: "Dog", imageUrl: "/uploads/dog.webp" }}
        size="sm"
        onVote={vi.fn()}
      />,
    );

    const catButton = screen.getByRole("button", { name: /cat/i });
    const catImage = screen.getByAltText("Cat") as HTMLImageElement;

    expect(catImage.src).toContain("/uploads/cat.poster.webp");
    fireEvent.pointerEnter(catButton);
    expect(catImage.src).toContain("/uploads/cat.gif");
    fireEvent.pointerLeave(catButton);
    expect(catImage.src).toContain("/uploads/cat.poster.webp");
  });

  it("animates gif item on keyboard focus", () => {
    render(
      <MatchupVoter
        itemA={{ id: "a", label: "Cat", imageUrl: "/uploads/cat.gif" }}
        itemB={{ id: "b", label: "Dog", imageUrl: "/uploads/dog.webp" }}
        size="sm"
        onVote={vi.fn()}
      />,
    );

    const catButton = screen.getByRole("button", { name: /cat/i });
    const catImage = screen.getByAltText("Cat") as HTMLImageElement;

    fireEvent.focus(catButton);
    expect(catImage.src).toContain("/uploads/cat.gif");
    fireEvent.blur(catButton);
    expect(catImage.src).toContain("/uploads/cat.poster.webp");
  });
});
