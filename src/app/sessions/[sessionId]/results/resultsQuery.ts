import {
  type BrowseQueryState,
  EVERYONE_COMPARE_TOKEN,
  type ResultsView,
} from "./resultsViewModel.types";

export function deriveBrowseQueryState({
  canViewIndividualBallots,
  requestedView,
  requestedParticipantId,
  requestedCompareParticipantId,
}: {
  canViewIndividualBallots: boolean;
  requestedView: ResultsView;
  requestedParticipantId: string | null;
  requestedCompareParticipantId: string | null;
}): BrowseQueryState {
  const initialView: ResultsView =
    canViewIndividualBallots && requestedView === "browse" ? "browse" : "everyone";
  const participantId =
    canViewIndividualBallots && initialView === "browse" ? requestedParticipantId : null;
  const compareEveryone =
    canViewIndividualBallots &&
    initialView === "browse" &&
    !!participantId &&
    requestedCompareParticipantId === EVERYONE_COMPARE_TOKEN;
  const compareParticipantId =
    canViewIndividualBallots &&
    initialView === "browse" &&
    participantId &&
    requestedCompareParticipantId &&
    requestedCompareParticipantId !== EVERYONE_COMPARE_TOKEN &&
    requestedCompareParticipantId !== participantId
      ? requestedCompareParticipantId
      : null;

  return {
    initialView,
    participantId,
    compareParticipantId,
    compareEveryone,
  };
}

export function buildResultsHref({
  sessionId,
  view,
  participantId,
  compareParticipantId,
}: {
  sessionId: string;
  view: ResultsView;
  participantId?: string | null;
  compareParticipantId?: string | null;
}): string {
  if (view === "everyone") return `/sessions/${sessionId}/results`;

  const params = new URLSearchParams({ view: "browse" });
  if (participantId) params.set("participant", participantId);
  if (compareParticipantId) params.set("compare", compareParticipantId);
  return `/sessions/${sessionId}/results?${params.toString()}`;
}
