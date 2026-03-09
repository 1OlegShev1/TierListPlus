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
  highlightDifferences,
  onToggleHighlightDifferences = () => undefined,
  hasCompareSelection = true,
}: {
  highlightDifferences: boolean;
  onToggleHighlightDifferences?: () => void;
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
    highlightDifferences,
    onToggleHighlightDifferences,
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

  it("keeps compare columns neutral when highlight toggle is off", () => {
    render(<BrowseResultsSection {...buildProps({ highlightDifferences: false })} />);

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

  it("applies compare difference maps to both columns when highlight toggle is on", () => {
    render(<BrowseResultsSection {...buildProps({ highlightDifferences: true })} />);

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

  it("toggles highlight state from compare header control", () => {
    const onToggle = vi.fn();

    render(
      <BrowseResultsSection
        {...buildProps({
          highlightDifferences: false,
          onToggleHighlightDifferences: onToggle,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Highlight differences Off/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders single-grid mode without compare controls when compare is not active", () => {
    render(
      <BrowseResultsSection
        {...buildProps({
          highlightDifferences: true,
          hasCompareSelection: false,
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /Highlight differences/i })).toBeNull();
    expect(resultsTierGridSpy).toHaveBeenCalledTimes(1);
    expect(compareColumnSpy).not.toHaveBeenCalled();
  });
});
