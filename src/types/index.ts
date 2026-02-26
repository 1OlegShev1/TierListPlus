export type { TierConfig } from "@/lib/constants";

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
  status: string;
  bracketEnabled: boolean;
  tierConfig: import("@/lib/constants").TierConfig[];
  items: Item[];
}

/** Template summary for lists and dropdowns */
export interface TemplateSummary {
  id: string;
  name: string;
  _count: { items: number };
}

/** A single vote placement (item in a tier at a rank) */
export interface VotePayload {
  sessionItemId: string;
  tierKey: string;
  rankInTier: number;
}
