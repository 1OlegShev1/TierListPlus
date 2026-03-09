import {
  buildBrowseParticipantRows,
  buildResultsHref,
  deriveBrowseQueryState,
  deriveBrowserListHeightClass,
  deriveResultsViewState,
  EVERYONE_COMPARE_TOKEN,
  filterBrowseParticipants,
} from "@/app/sessions/[sessionId]/results/resultsViewModel";
import type { SessionResult } from "@/types";

function makeParticipant(id: string, nickname: string): SessionResult["participants"][number] {
  return {
    id,
    nickname,
    submittedAt: null,
    hasSubmitted: true,
    hasSavedVotes: true,
    rankedItemCount: 10,
    totalItemCount: 10,
    missingItemCount: 0,
    isComplete: true,
  };
}

describe("resultsViewModel", () => {
  it("builds consistent browse row actions for select, view, compare, and clear compare", () => {
    const rows = buildBrowseParticipantRows({
      sessionId: "session_1",
      participants: [
        makeParticipant("p1", "Alice"),
        makeParticipant("p2", "Bob"),
        makeParticipant("p3", "Cara"),
      ],
      currentParticipantId: "p1",
      participantId: "p1",
      compareParticipantId: "p2",
    });

    expect(rows).toHaveLength(3);

    const selected = rows.find((row) => row.id === "p1");
    const compared = rows.find((row) => row.id === "p2");
    const neutral = rows.find((row) => row.id === "p3");

    expect(selected).toMatchObject({
      isSelected: true,
      isCompared: false,
      isFocused: true,
      isCurrentParticipant: true,
      viewHref: "/sessions/session_1/results?view=browse&participant=p1#results",
      compareHref: null,
      clearCompareHref: null,
    });

    expect(compared).toMatchObject({
      isSelected: false,
      isCompared: true,
      isFocused: true,
      viewHref: "/sessions/session_1/results?view=browse&participant=p2#results",
      clearCompareHref: "/sessions/session_1/results?view=browse&participant=p1#results",
    });

    expect(neutral).toMatchObject({
      isSelected: false,
      isCompared: false,
      isFocused: false,
      viewHref: "/sessions/session_1/results?view=browse&participant=p3#results",
      compareHref: "/sessions/session_1/results?view=browse&participant=p1&compare=p3",
      clearCompareHref: null,
    });
  });

  it("pins compared first, then current participant, while preserving remaining order", () => {
    const rows = buildBrowseParticipantRows({
      sessionId: "session_1",
      participants: [
        makeParticipant("p2", "Bob"),
        makeParticipant("p3", "Cara"),
        makeParticipant("p1", "Alice"),
      ],
      currentParticipantId: "p1",
      participantId: "p2",
      compareParticipantId: "p3",
    });

    expect(rows[0]?.id).toBe("p3");
    expect(rows[1]?.id).toBe("p1");
    expect(rows[2]?.id).toBe("p2");
  });

  it("does not pin selected voter without compare selection", () => {
    const rows = buildBrowseParticipantRows({
      sessionId: "session_1",
      participants: [
        makeParticipant("p2", "Bob"),
        makeParticipant("p3", "Cara"),
        makeParticipant("p1", "Alice"),
      ],
      currentParticipantId: "p1",
      participantId: "p3",
      compareParticipantId: null,
    });

    expect(rows.map((row) => row.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("pins current participant to the top when nothing is selected", () => {
    const rows = buildBrowseParticipantRows({
      sessionId: "session_1",
      participants: [
        makeParticipant("p2", "Bob"),
        makeParticipant("p3", "Cara"),
        makeParticipant("p1", "Alice"),
      ],
      currentParticipantId: "p1",
      participantId: null,
      compareParticipantId: null,
    });

    expect(rows[0]?.id).toBe("p1");
    expect(rows[0]?.isCurrentParticipant).toBe(true);
  });

  it("derives view labels for everyone and browse states", () => {
    const everyone = deriveResultsViewState({
      canViewIndividualBallots: true,
      initialView: "everyone",
      hasPrimarySelection: false,
      hasCompareSelection: false,
      hasSearchQuery: false,
      participantName: null,
      selectedNickname: null,
      compareParticipantName: null,
      comparedNickname: null,
    });
    expect(everyone.activeView).toBe("everyone");
    expect(everyone.contextTitle).toBe("Everyone's ranking");

    const compare = deriveResultsViewState({
      canViewIndividualBallots: true,
      initialView: "browse",
      hasPrimarySelection: true,
      hasCompareSelection: true,
      hasSearchQuery: false,
      participantName: "Alice",
      selectedNickname: "Alice",
      compareParticipantName: "Bob",
      comparedNickname: "Bob",
    });
    expect(compare.activeView).toBe("browse");
    expect(compare.isBrowseView).toBe(true);
    expect(compare.browseHeaderTitle).toBe("Alice vs Bob");
  });

  it("builds everyone and browse hrefs", () => {
    expect(
      buildResultsHref({
        sessionId: "session_1",
        view: "everyone",
      }),
    ).toBe("/sessions/session_1/results");

    expect(
      buildResultsHref({
        sessionId: "session_1",
        view: "browse",
        participantId: "p1",
        compareParticipantId: EVERYONE_COMPARE_TOKEN,
      }),
    ).toBe("/sessions/session_1/results?view=browse&participant=p1&compare=everyone");
  });

  it("derives browse query state and normalizes invalid compare selections", () => {
    expect(
      deriveBrowseQueryState({
        canViewIndividualBallots: true,
        requestedView: "browse",
        requestedParticipantId: "p1",
        requestedCompareParticipantId: "p2",
      }),
    ).toMatchObject({
      initialView: "browse",
      participantId: "p1",
      compareParticipantId: "p2",
      compareEveryone: false,
    });

    expect(
      deriveBrowseQueryState({
        canViewIndividualBallots: true,
        requestedView: "browse",
        requestedParticipantId: "p1",
        requestedCompareParticipantId: EVERYONE_COMPARE_TOKEN,
      }),
    ).toMatchObject({
      initialView: "browse",
      participantId: "p1",
      compareParticipantId: null,
      compareEveryone: true,
    });

    expect(
      deriveBrowseQueryState({
        canViewIndividualBallots: true,
        requestedView: "browse",
        requestedParticipantId: "p1",
        requestedCompareParticipantId: "p1",
      }),
    ).toMatchObject({
      initialView: "browse",
      participantId: "p1",
      compareParticipantId: null,
      compareEveryone: false,
    });

    expect(
      deriveBrowseQueryState({
        canViewIndividualBallots: false,
        requestedView: "browse",
        requestedParticipantId: "p1",
        requestedCompareParticipantId: "p2",
      }),
    ).toMatchObject({
      initialView: "everyone",
      participantId: null,
      compareParticipantId: null,
      compareEveryone: false,
    });
  });

  it("keeps selected and compared rows while filtering search results", () => {
    const filtered = filterBrowseParticipants({
      participants: [
        makeParticipant("p1", "Alice"),
        makeParticipant("p2", "Bob"),
        makeParticipant("p3", "Cara"),
      ],
      searchQuery: "ca",
      participantId: "p1",
      compareParticipantId: "p2",
    });

    expect(filtered.map((participant) => participant.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("derives browser list height with search override", () => {
    expect(
      deriveBrowserListHeightClass({
        hasPrimarySelection: true,
        hasSearchQuery: false,
      }),
    ).toBe("max-h-[28vh] sm:max-h-[32vh] lg:max-h-[36vh]");

    expect(
      deriveBrowserListHeightClass({
        hasPrimarySelection: false,
        hasSearchQuery: false,
      }),
    ).toBe("max-h-[44vh] sm:max-h-[48vh]");

    expect(
      deriveBrowserListHeightClass({
        hasPrimarySelection: true,
        hasSearchQuery: true,
      }),
    ).toBe("max-h-[58vh] sm:max-h-[62vh] lg:max-h-[66vh]");
  });
});
