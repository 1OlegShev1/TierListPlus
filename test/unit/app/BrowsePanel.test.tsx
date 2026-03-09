// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { BrowsePanel } from "@/app/sessions/[sessionId]/results/BrowsePanel";
import type { BrowseParticipantRow } from "@/app/sessions/[sessionId]/results/resultsViewModel";

type MockLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string | URL;
  replace?: boolean;
  scroll?: boolean;
};

const replaceMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, replace, scroll, children, ...rest }: MockLinkProps) => (
    <a
      href={typeof href === "string" ? href : href.toString()}
      data-replace={replace ? "true" : "false"}
      data-scroll={scroll === undefined ? "undefined" : String(scroll)}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

function makeRows(): BrowseParticipantRow[] {
  return [
    {
      id: "p1",
      nickname: "Alice",
      isCurrentParticipant: true,
      isSelected: true,
      isCompared: false,
      isFocused: true,
      selectHref: "/sessions/s1/results?view=browse&participant=p1",
      viewHref: "/sessions/s1/results?view=browse&participant=p1#results",
      compareHref: null,
      clearCompareHref: null,
    },
    {
      id: "p2",
      nickname: "Bob",
      isCurrentParticipant: false,
      isSelected: false,
      isCompared: true,
      isFocused: true,
      selectHref: "/sessions/s1/results?view=browse&participant=p2",
      viewHref: "/sessions/s1/results?view=browse&participant=p2#results",
      compareHref: null,
      clearCompareHref: "/sessions/s1/results?view=browse&participant=p1#results",
    },
    {
      id: "p3",
      nickname: "Cara",
      isCurrentParticipant: false,
      isSelected: false,
      isCompared: false,
      isFocused: false,
      selectHref: "/sessions/s1/results?view=browse&participant=p3",
      viewHref: "/sessions/s1/results?view=browse&participant=p3#results",
      compareHref: "/sessions/s1/results?view=browse&participant=p1&compare=p3",
      clearCompareHref: null,
    },
  ];
}

describe("BrowsePanel", () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it("keeps selected-row View as scroll-only action even while comparing", () => {
    const onScrollToResults = vi.fn();

    render(
      <BrowsePanel
        title="Alice vs Bob"
        isOpen
        onToggleOpen={() => undefined}
        searchQuery=""
        onSearchChange={() => undefined}
        onClearSearch={() => undefined}
        stopComparingHref="/sessions/s1/results?view=browse&participant=p1"
        clearSelectionHref="/sessions/s1/results?view=browse"
        compareWithEveryoneHref="/sessions/s1/results?view=browse&participant=p1&compare=everyone"
        listHeightClass="max-h-[20vh]"
        rows={makeRows()}
        onScrollToResults={onScrollToResults}
      />,
    );

    const selectedViewButton = screen.getByRole("button", { name: "View" });
    fireEvent.click(selectedViewButton);

    expect(onScrollToResults).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "View" })).toHaveLength(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("selects or deselects when clicking the voter card hitbox", () => {
    render(
      <BrowsePanel
        title="Alice vs Bob"
        isOpen
        onToggleOpen={() => undefined}
        searchQuery=""
        onSearchChange={() => undefined}
        onClearSearch={() => undefined}
        stopComparingHref="/sessions/s1/results?view=browse&participant=p1"
        clearSelectionHref="/sessions/s1/results?view=browse"
        compareWithEveryoneHref="/sessions/s1/results?view=browse&participant=p1&compare=everyone"
        listHeightClass="max-h-[20vh]"
        rows={makeRows()}
        onScrollToResults={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTestId("browse-row-hitbox-p1"));
    expect(replaceMock).toHaveBeenCalledWith("/sessions/s1/results?view=browse", {
      scroll: false,
    });

    fireEvent.click(screen.getByTestId("browse-row-hitbox-p3"));
    expect(replaceMock).toHaveBeenCalledWith("/sessions/s1/results?view=browse&participant=p3", {
      scroll: false,
    });
  });

  it("marks transient browse navigation links as replace", () => {
    render(
      <BrowsePanel
        title="Alice vs Bob"
        isOpen
        onToggleOpen={() => undefined}
        searchQuery=""
        onSearchChange={() => undefined}
        onClearSearch={() => undefined}
        stopComparingHref="/sessions/s1/results?view=browse&participant=p1"
        clearSelectionHref="/sessions/s1/results?view=browse"
        compareWithEveryoneHref="/sessions/s1/results?view=browse&participant=p1&compare=everyone"
        listHeightClass="max-h-[20vh]"
        rows={makeRows()}
        onScrollToResults={() => undefined}
      />,
    );

    expect(screen.getByRole("link", { name: "Stop comparing" }).getAttribute("data-replace")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "Stop comparing" }).getAttribute("data-scroll")).toBe(
      "false",
    );
    expect(
      screen.getByRole("link", { name: "Compare with Everyone" }).getAttribute("data-replace"),
    ).toBe("true");
    expect(screen.getByRole("link", { name: "Clear compare" }).getAttribute("data-replace")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "Compare" }).getAttribute("data-replace")).toBe("true");
    expect(screen.getByRole("link", { name: "Compare" }).getAttribute("data-scroll")).toBe("false");

    for (const viewLink of screen.getAllByRole("link", { name: "View" })) {
      expect(viewLink.getAttribute("data-replace")).toBe("true");
    }
  });
});
