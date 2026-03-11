// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { createRef } from "react";
import { BrowseResultsSection } from "@/app/sessions/[sessionId]/results/BrowseResultsSection";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";

const compareColumnSpy = vi.hoisted(() => vi.fn());
const resultsTierGridSpy = vi.hoisted(() => vi.fn());

vi.mock("@/app/sessions/[sessionId]/results/ResultsTierGrid", () => ({
  CompareColumn: (props: Record<string, unknown>) => {
    compareColumnSpy(props);
    return <div data-testid={`compare-column-${String(props.title)}`} />;
  },
  ResultsTierGrid: (props: Record<string, unknown>) => {
    resultsTierGridSpy(props);
    return <div data-testid="single-results-grid" />;
  },
}));

function makeItem(id: string): ConsensusItem {
  return {
    id,
    label: id,
    imageUrl: "",
    sourceUrl: null,
    sourceProvider: null,
    sourceNote: null,
    sourceStartSec: null,
    sourceEndSec: null,
    averageScore: 0,
    voteDistribution: {},
    voterNicknamesByTier: {},
    totalVotes: 0,
  };
}

function makeTier(key: string, items: string[]): ConsensusTier {
  return {
    key,
    label: key,
    color: "#000000",
    sortOrder: 0,
    items: items.map(makeItem),
  };
}

function buildProps({
  compareHighlightMode,
  onChangeCompareHighlightMode,
  hasCompareSelection = true,
}: {
  compareHighlightMode: "off" | "differences" | "similarities";
  onChangeCompareHighlightMode?: (mode: "off" | "differences" | "similarities") => void;
  hasCompareSelection?: boolean;
}) {
  return {
    resultsRef: createRef<HTMLDivElement>() as RefObject<HTMLDivElement | null>,
    hasCompareSelection,
    hasEveryoneCompareSelection: false,
    initialParticipantName: "Alice",
    selectedNickname: "Alice",
    initialParticipantTiers: [makeTier("S", ["a"]), makeTier("A", ["b"])],
    initialCompareParticipantName: "Bob",
    comparedNickname: "Bob",
    compareRightTiers: [makeTier("S", ["a"]), makeTier("A", ["c"])],
    compareLeftSelectedItem: null,
    compareRightSelectedItem: null,
    selectedItem: null,
    compareHighlightMode,
    onChangeCompareHighlightMode: onChangeCompareHighlightMode ?? (() => undefined),
    onCompareLeftToggle: () => undefined,
    onCompareRightToggle: () => undefined,
    onItemToggle: () => undefined,
    onOpenSource: () => undefined,
  };
}

describe("BrowseResultsSection", () => {
  beforeEach(() => {
    compareColumnSpy.mockClear();
    resultsTierGridSpy.mockClear();
  });

  it("keeps compare columns neutral when highlight mode is off", () => {
    render(<BrowseResultsSection {...buildProps({ compareHighlightMode: "off" })} />);

    expect(compareColumnSpy).toHaveBeenCalledTimes(2);
    const leftProps = compareColumnSpy.mock.calls[0]?.[0] as {
      compareDifferenceStateByItemId: Record<string, string>;
    };
    const rightProps = compareColumnSpy.mock.calls[1]?.[0] as {
      compareDifferenceStateByItemId: Record<string, string>;
    };

    expect(leftProps.compareDifferenceStateByItemId).toEqual({});
    expect(rightProps.compareDifferenceStateByItemId).toEqual({});
  });

  it("applies compare difference maps when mode is differences", () => {
    render(<BrowseResultsSection {...buildProps({ compareHighlightMode: "differences" })} />);

    expect(compareColumnSpy).toHaveBeenCalledTimes(2);
    const leftProps = compareColumnSpy.mock.calls[0]?.[0] as {
      compareDifferenceStateByItemId: Record<string, string>;
    };
    const rightProps = compareColumnSpy.mock.calls[1]?.[0] as {
      compareDifferenceStateByItemId: Record<string, string>;
    };

    expect(leftProps.compareDifferenceStateByItemId).toEqual({
      a: "same",
      b: "changed",
    });
    expect(rightProps.compareDifferenceStateByItemId).toEqual({
      a: "same",
      c: "changed",
    });
  });

  it("flips compare states when mode is similarities", () => {
    render(<BrowseResultsSection {...buildProps({ compareHighlightMode: "similarities" })} />);

    expect(compareColumnSpy).toHaveBeenCalledTimes(2);
    const leftProps = compareColumnSpy.mock.calls[0]?.[0] as {
      compareDifferenceStateByItemId: Record<string, string>;
    };
    const rightProps = compareColumnSpy.mock.calls[1]?.[0] as {
      compareDifferenceStateByItemId: Record<string, string>;
    };

    // Flipped: "same" items now marked "changed" (highlighted), "changed" items marked "same" (dimmed)
    expect(leftProps.compareDifferenceStateByItemId).toEqual({
      a: "changed",
      b: "same",
    });
    expect(rightProps.compareDifferenceStateByItemId).toEqual({
      a: "changed",
      c: "same",
    });
  });

  it("calls onChangeCompareHighlightMode when clicking a segment", () => {
    const onChange = vi.fn();

    render(
      <BrowseResultsSection
        {...buildProps({
          compareHighlightMode: "off",
          onChangeCompareHighlightMode: onChange,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Differences/i }));
    expect(onChange).toHaveBeenCalledWith("differences");
  });

  it("exposes pressed state and grouped label for compare highlight controls", () => {
    render(<BrowseResultsSection {...buildProps({ compareHighlightMode: "similarities" })} />);

    const group = screen.getByRole("group", { name: /Compare highlight mode/i });
    const differencesButton = screen.getByRole("button", { name: "Differences" });
    const similaritiesButton = screen.getByRole("button", { name: "Similarities" });

    expect(group).toBeTruthy();
    expect(differencesButton.getAttribute("aria-pressed")).toBe("false");
    expect(similaritiesButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders single-grid mode without compare controls when compare is not active", () => {
    render(
      <BrowseResultsSection
        {...buildProps({
          compareHighlightMode: "differences",
          hasCompareSelection: false,
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /Differences/i })).toBeNull();
    expect(resultsTierGridSpy).toHaveBeenCalledTimes(1);
    expect(compareColumnSpy).not.toHaveBeenCalled();
  });
});
