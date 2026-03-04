import type { TierConfig } from "@/lib/constants";

export type { TierConfig };

/** A displayable item with id, label, and image. Used throughout the app for session items, bracket items, template items. */
export interface Item {
  id: string;
  label: string;
  imageUrl: string;
}

/** A bracket matchup as returned by the API (with nested item objects) */
export interface Matchup {
  id: string;
  round: number;
  position: number;
  itemA: Item | null;
  itemB: Item | null;
  winner: Item | null;
  votes: { participantId: string; chosenItemId: string }[];
}

/** Bracket data as returned from GET /api/sessions/[sessionId]/bracket */
export interface BracketData {
  id: string;
  rounds: number;
  matchups: Matchup[];
}

/** A flat matchup row (IDs only, no nested objects). Used in local bracket state and ranking algorithms. */
export interface MatchupRow {
  round: number;
  position: number;
  itemAId: string | null;
  itemBId: string | null;
  winnerId: string | null;
}

/** Session data as fetched for the vote page */
export interface SessionData {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  creatorId: string | null;
  isPrivate: boolean;
  isLocked: boolean;
  bracketEnabled: boolean;
  templateIsHidden: boolean;
  tierConfig: TierConfig[];
  items: Item[];
  currentParticipantId: string | null;
  currentParticipantNickname: string | null;
}

/** List summary for lists and dropdowns */
export interface ListSummary {
  id: string;
  name: string;
  isPublic: boolean;
  _count: { items: number };
  items: { id: string; imageUrl: string; label?: string | null }[];
}

/** A single vote placement (item in a tier at a rank) */
export interface VotePayload {
  sessionItemId: string;
  tierKey: string;
  rankInTier: number;
}

/** A template item (with optional id for new unsaved items) */
export interface TemplateItemData {
  id?: string;
  label: string;
  imageUrl: string;
  sortOrder: number;
}

/** Session result summary for the results page */
export interface SessionResult {
  creatorId: string | null;
  status: string;
  name: string;
  joinCode: string;
  currentParticipantId: string | null;
  currentParticipantNickname: string | null;
  tierConfig: TierConfig[];
  participants: {
    id: string;
    nickname: string;
    submittedAt: string | null;
    hasSubmitted: boolean;
    hasSavedVotes: boolean;
    rankedItemCount: number;
    totalItemCount: number;
    missingItemCount: number;
    isComplete: boolean;
  }[];
}
