import { buildCompareDifferenceStates } from "@/app/sessions/[sessionId]/results/resultsCompareDiff";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";

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

describe("buildCompareDifferenceStates", () => {
  it("marks items as same when they remain in the same tier", () => {
    const result = buildCompareDifferenceStates({
      leftTiers: [makeTier("S", ["a"]), makeTier("A", ["b"])],
      rightTiers: [makeTier("S", ["a"]), makeTier("A", ["b"])],
    });

    expect(result.left).toEqual({ a: "same", b: "same" });
    expect(result.right).toEqual({ a: "same", b: "same" });
  });

  it("marks items as changed when tier placement differs", () => {
    const result = buildCompareDifferenceStates({
      leftTiers: [makeTier("S", ["a"]), makeTier("A", ["b"])],
      rightTiers: [makeTier("S", ["b"]), makeTier("A", ["a"])],
    });

    expect(result.left).toEqual({ a: "changed", b: "changed" });
    expect(result.right).toEqual({ a: "changed", b: "changed" });
  });

  it("marks items as changed when present on only one side", () => {
    const result = buildCompareDifferenceStates({
      leftTiers: [makeTier("S", ["a"]), makeTier("A", [])],
      rightTiers: [makeTier("S", []), makeTier("A", ["b"])],
    });

    expect(result.left).toEqual({ a: "changed" });
    expect(result.right).toEqual({ b: "changed" });
  });
});
