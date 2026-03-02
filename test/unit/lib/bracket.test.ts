import { generateBracket } from "@/lib/bracket-generator";
import { mitBacktrackRanking } from "@/lib/bracket-ranking";

describe("mitBacktrackRanking", () => {
  it("returns winner first, finalist second, and backtracks losses", () => {
    const ranking = mitBacktrackRanking(
      [
        { round: 1, position: 0, itemAId: "a", itemBId: "b", winnerId: "a" },
        { round: 1, position: 1, itemAId: "c", itemBId: "d", winnerId: "c" },
        { round: 2, position: 0, itemAId: "a", itemBId: "c", winnerId: "a" },
      ],
      2,
      ["a", "b", "c", "d"],
    );

    expect(ranking).toEqual(["a", "c", "b", "d"]);
  });

  it("falls back when the final matchup is incomplete and appends missing items", () => {
    const ranking = mitBacktrackRanking(
      [
        { round: 1, position: 0, itemAId: "a", itemBId: "b", winnerId: "a" },
        { round: 1, position: 1, itemAId: "c", itemBId: "d", winnerId: "c" },
        { round: 2, position: 0, itemAId: "a", itemBId: "c", winnerId: null },
      ],
      2,
      ["a", "b", "c", "d", "e"],
    );

    expect(ranking).toEqual(["b", "d", "a", "c", "e"]);
  });
});

describe("generateBracket", () => {
  it("creates a deterministic bracket with byes when Math.random is stubbed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const bracket = generateBracket(["a", "b", "c"]);

    expect(bracket.rounds).toBe(2);
    expect(bracket.matchups).toEqual([
      { round: 1, position: 0, itemAId: "b", itemBId: "c" },
      { round: 1, position: 1, itemAId: "a", itemBId: null },
      { round: 2, position: 0, itemAId: null, itemBId: null },
    ]);
  });
});
