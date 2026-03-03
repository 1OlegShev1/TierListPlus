import { computeConsensus } from "@/lib/consensus";
import type { Item, TierConfig } from "@/types";

const tierConfig: TierConfig[] = [
  { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
  { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
  { key: "B", label: "B", color: "#ffdf7f", sortOrder: 2 },
];

const items: Item[] = [
  { id: "i1", label: "One", imageUrl: "/1" },
  { id: "i2", label: "Two", imageUrl: "/2" },
  { id: "i3", label: "Three", imageUrl: "/3" },
];

describe("computeConsensus", () => {
  it("assigns scores, preserves within-tier order, and aggregates counts", () => {
    const consensus = computeConsensus(
      [
        {
          participantId: "p1",
          participantNickname: "Zed",
          sessionItemId: "i1",
          tierKey: "S",
          rankInTier: 0,
        },
        {
          participantId: "p1",
          participantNickname: "Zed",
          sessionItemId: "i2",
          tierKey: "S",
          rankInTier: 1,
        },
        {
          participantId: "p1",
          participantNickname: "Zed",
          sessionItemId: "i3",
          tierKey: "B",
          rankInTier: 0,
        },
        {
          participantId: "p2",
          participantNickname: "Amy",
          sessionItemId: "i1",
          tierKey: "S",
          rankInTier: 0,
        },
        {
          participantId: "p2",
          participantNickname: "Amy",
          sessionItemId: "i2",
          tierKey: "A",
          rankInTier: 0,
        },
        {
          participantId: "p2",
          participantNickname: "Amy",
          sessionItemId: "i3",
          tierKey: "B",
          rankInTier: 0,
        },
        {
          participantId: "p2",
          participantNickname: "Amy",
          sessionItemId: "missing",
          tierKey: "S",
          rankInTier: 0,
        },
      ],
      tierConfig,
      items,
    );

    const topTier = consensus[0];
    const middleTier = consensus[1];
    const bottomTier = consensus[2];

    expect(topTier.items.map((item) => item.id)).toEqual(["i1", "i2"]);
    expect(topTier.items[0].voteDistribution).toEqual({ S: 2 });
    expect(topTier.items[0].voterNicknamesByTier).toEqual({ S: ["Amy", "Zed"] });
    expect(topTier.items[0].totalVotes).toBe(2);

    expect(topTier.items[1].voteDistribution).toEqual({ S: 1, A: 1 });
    expect(topTier.items[1].voterNicknamesByTier).toEqual({ A: ["Amy"], S: ["Zed"] });
    expect(topTier.items[0].averageScore).toBeGreaterThan(topTier.items[1].averageScore);
    expect(middleTier.items).toEqual([]);

    expect(bottomTier.items.map((item) => item.id)).toEqual(["i3"]);
    expect(bottomTier.items[0].voteDistribution).toEqual({ B: 2 });
    expect(bottomTier.items[0].voterNicknamesByTier).toEqual({ B: ["Amy", "Zed"] });
  });

  it("puts unvoted items in the lowest tier", () => {
    const consensus = computeConsensus(
      [{ participantId: "p1", sessionItemId: "i1", tierKey: "S", rankInTier: 0 }],
      tierConfig,
      items,
    );

    expect(consensus[2].items.map((item) => item.id)).toEqual(["i2", "i3"]);
  });

  it("uses zero bonus for single-item tiers", () => {
    const consensus = computeConsensus(
      [
        { participantId: "p1", sessionItemId: "i1", tierKey: "S", rankInTier: 0 },
        { participantId: "p1", sessionItemId: "i2", tierKey: "A", rankInTier: 0 },
      ],
      tierConfig,
      items,
    );

    expect(consensus[0].items[0].averageScore).toBe(3);
    expect(consensus[1].items[0].averageScore).toBe(2);
  });
});
