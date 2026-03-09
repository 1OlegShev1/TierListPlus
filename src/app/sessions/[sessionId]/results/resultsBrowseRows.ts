import type { SessionResult } from "@/types";
import { buildResultsHref } from "./resultsQuery";

export interface BrowseParticipantRow {
  id: string;
  nickname: string;
  isCurrentParticipant: boolean;
  isSelected: boolean;
  isCompared: boolean;
  isFocused: boolean;
  selectHref: string;
  viewHref: string;
  compareHref: string | null;
  clearCompareHref: string | null;
}

export function filterBrowseParticipants({
  participants,
  searchQuery,
  participantId,
  compareParticipantId,
}: {
  participants: SessionResult["participants"];
  searchQuery: string;
  participantId: string | null;
  compareParticipantId: string | null;
}) {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  return participants.filter((participant) => {
    if (participant.id === participantId || participant.id === compareParticipantId) return true;
    if (normalizedSearch.length === 0) return true;
    return participant.nickname.toLowerCase().includes(normalizedSearch);
  });
}

export function buildBrowseParticipantRows({
  sessionId,
  participants,
  currentParticipantId,
  participantId,
  compareParticipantId,
}: {
  sessionId: string;
  participants: SessionResult["participants"];
  currentParticipantId: string | null;
  participantId: string | null;
  compareParticipantId: string | null;
}): BrowseParticipantRow[] {
  const orderedParticipants = [...participants];
  const getPriority = (id: string) => {
    if (compareParticipantId && id === compareParticipantId) return 0;
    if (currentParticipantId && id === currentParticipantId) return 1;
    return 2;
  };
  orderedParticipants.sort((a, b) => getPriority(a.id) - getPriority(b.id));

  return orderedParticipants.map((participant) => {
    const isSelected = participant.id === participantId;
    const isCompared = participant.id === compareParticipantId;
    const isFocused = isSelected || isCompared;
    const selectHref = buildResultsHref({
      sessionId,
      view: "browse",
      participantId: participant.id,
    });

    return {
      id: participant.id,
      nickname: participant.nickname,
      isCurrentParticipant: participant.id === currentParticipantId,
      isSelected,
      isCompared,
      isFocused,
      selectHref,
      viewHref: `${selectHref}#results`,
      compareHref:
        participantId && !isSelected
          ? buildResultsHref({
              sessionId,
              view: "browse",
              participantId,
              compareParticipantId: participant.id,
            })
          : null,
      clearCompareHref:
        participantId && isCompared
          ? `${buildResultsHref({
              sessionId,
              view: "browse",
              participantId,
            })}#results`
          : null,
    };
  });
}
