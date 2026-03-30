import type { ResultsView, ResultsViewState } from "./resultsViewModel.types";

function getDisplayName(primary: string | null, fallback: string | null, empty: string) {
  return primary ?? fallback ?? empty;
}

export function deriveBrowserListHeightClass({
  hasPrimarySelection,
  hasSearchQuery,
}: {
  hasPrimarySelection: boolean;
  hasSearchQuery: boolean;
}): string {
  if (hasSearchQuery) {
    return "max-h-[58vh] sm:max-h-[62vh] lg:max-h-[66vh]";
  }

  return hasPrimarySelection
    ? "max-h-[28vh] sm:max-h-[32vh] lg:max-h-[36vh]"
    : "max-h-[44vh] sm:max-h-[48vh]";
}

export function deriveResultsViewState({
  canViewIndividualBallots,
  initialView,
  hasPrimarySelection,
  hasCompareSelection,
  hasSearchQuery,
  participantName,
  selectedNickname,
  compareParticipantName,
  comparedNickname,
}: {
  canViewIndividualBallots: boolean;
  initialView: ResultsView;
  hasPrimarySelection: boolean;
  hasCompareSelection: boolean;
  hasSearchQuery: boolean;
  participantName: string | null;
  selectedNickname: string | null;
  compareParticipantName: string | null;
  comparedNickname: string | null;
}): ResultsViewState {
  const activeView: ResultsView =
    canViewIndividualBallots && initialView === "browse" ? "browse" : "everyone";
  const isBrowseView = activeView === "browse" && canViewIndividualBallots;

  const primaryLabel = getDisplayName(participantName, selectedNickname, "Someone");
  const compareLabel = getDisplayName(compareParticipantName, comparedNickname, "someone");

  return {
    activeView,
    isBrowseView,
    contextTitle: "Everyone's ranking",
    contextDescription: "Based on all submitted rankings.",
    browseHeaderTitle: hasCompareSelection
      ? `${primaryLabel} vs ${compareLabel}`
      : hasPrimarySelection
        ? `${primaryLabel}'s ranking`
        : "Browse people",
    browserListHeightClass: deriveBrowserListHeightClass({
      hasPrimarySelection,
      hasSearchQuery,
    }),
  };
}
