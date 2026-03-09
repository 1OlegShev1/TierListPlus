export type ResultsView = "everyone" | "browse";
export const EVERYONE_COMPARE_TOKEN = "everyone";

export interface ResultsViewState {
  activeView: ResultsView;
  isBrowseView: boolean;
  contextTitle: string;
  contextDescription: string;
  browseHeaderTitle: string;
  browserListHeightClass: string;
}

export interface BrowseQueryState {
  initialView: ResultsView;
  participantId: string | null;
  compareParticipantId: string | null;
  compareEveryone: boolean;
}
