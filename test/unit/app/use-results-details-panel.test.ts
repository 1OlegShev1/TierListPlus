// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useResultsDetailsPanel } from "@/app/sessions/[sessionId]/results/useResultsDetailsPanel";
import type { ConsensusItem } from "@/lib/consensus";

function makeItem(id: string, label: string): ConsensusItem {
  return {
    id,
    label,
    imageUrl: `/uploads/${id}.png`,
    averageScore: 0,
    voteDistribution: {},
    voterNicknamesByTier: {},
    totalVotes: 0,
  };
}

describe("useResultsDetailsPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(hover: none) and (pointer: coarse)",
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

  it("clears selected item when participant changes", () => {
    const firstItem = makeItem("item_1", "Item 1");

    const { result, rerender } = renderHook(
      ({ participantId }) =>
        useResultsDetailsPanel({
          participantId,
          initialParticipantError: null,
        }),
      {
        initialProps: { participantId: "participant_1" },
      },
    );

    act(() => {
      result.current.handleItemToggle(firstItem);
    });
    expect(result.current.selectedItem?.id).toBe("item_1");

    rerender({ participantId: "participant_2" });
    expect(result.current.selectedItem).toBeNull();
  });
});
