"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsensusTier } from "@/lib/consensus";
import type { SessionResult } from "@/types";
import {
  buildBrowseParticipantRows,
  buildResultsHref,
  deriveResultsViewState,
  EVERYONE_COMPARE_TOKEN,
  filterBrowseParticipants,
  type ResultsView,
} from "./resultsViewModel";

export function useBrowseResultsState({
  sessionId,
  canViewIndividualBallots,
  initialView,
  participants,
  currentParticipantId,
  participantId,
  compareParticipantId,
  compareEveryone,
  initialParticipantName,
  initialCompareParticipantName,
  initialParticipantTiers,
  initialCompareParticipantTiers,
}: {
  sessionId: string;
  canViewIndividualBallots: boolean;
  initialView: ResultsView;
  participants: SessionResult["participants"];
  currentParticipantId: string | null;
  participantId: string | null;
  compareParticipantId: string | null;
  compareEveryone: boolean;
  initialParticipantName: string | null;
  initialCompareParticipantName: string | null;
  initialParticipantTiers: ConsensusTier[] | null;
  initialCompareParticipantTiers: ConsensusTier[] | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isBrowserOpen, setIsBrowserOpen] = useState(initialView === "browse");
  const previousInitialViewRef = useRef<ResultsView>(initialView);

  useEffect(() => {
    const wasBrowse = previousInitialViewRef.current === "browse";
    const isBrowse = initialView === "browse";
    if (!wasBrowse && isBrowse) {
      setIsBrowserOpen(true);
    }
    previousInitialViewRef.current = initialView;
  }, [initialView]);

  const participantsWithSavedVotes = participants.filter(
    (participant) => participant.hasSavedVotes,
  );
  const selectedParticipant =
    participantsWithSavedVotes.find((participant) => participant.id === participantId) ?? null;
  const comparedParticipant =
    participantsWithSavedVotes.find((participant) => participant.id === compareParticipantId) ??
    null;
  const hasPrimarySelection = !!selectedParticipant && !!initialParticipantTiers;
  const hasPersonCompareSelection =
    hasPrimarySelection && !!comparedParticipant && !!initialCompareParticipantTiers;
  const hasEveryoneCompareSelection = hasPrimarySelection && compareEveryone;
  const hasCompareSelection = hasPersonCompareSelection || hasEveryoneCompareSelection;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const viewState = deriveResultsViewState({
    canViewIndividualBallots,
    initialView,
    hasPrimarySelection,
    hasCompareSelection,
    hasSearchQuery,
    participantName: initialParticipantName,
    selectedNickname: selectedParticipant?.nickname ?? null,
    compareParticipantName: hasEveryoneCompareSelection
      ? "Everyone"
      : initialCompareParticipantName,
    comparedNickname: hasEveryoneCompareSelection
      ? "Everyone"
      : (comparedParticipant?.nickname ?? null),
  });

  const filteredParticipants = filterBrowseParticipants({
    participants: participantsWithSavedVotes,
    searchQuery,
    participantId,
    compareParticipantId,
  });
  const browseRows = buildBrowseParticipantRows({
    sessionId,
    participants: filteredParticipants,
    currentParticipantId,
    participantId,
    compareParticipantId,
  });

  const stopComparingHref =
    hasCompareSelection && participantId
      ? buildResultsHref({
          sessionId,
          view: "browse",
          participantId,
        })
      : null;
  const clearSelectionHref = hasPrimarySelection
    ? buildResultsHref({
        sessionId,
        view: "browse",
      })
    : null;
  const compareWithEveryoneHref =
    hasPrimarySelection && !hasEveryoneCompareSelection && participantId
      ? buildResultsHref({
          sessionId,
          view: "browse",
          participantId,
          compareParticipantId: EVERYONE_COMPARE_TOKEN,
        })
      : null;

  return {
    browseRows,
    clearSelectionHref,
    compareWithEveryoneHref,
    comparedParticipant,
    hasCompareSelection,
    hasEveryoneCompareSelection,
    hasPrimarySelection,
    isBrowserOpen,
    searchQuery,
    selectedParticipant,
    setSearchQuery,
    stopComparingHref,
    toggleBrowserOpen: () => setIsBrowserOpen((current) => !current),
    viewState,
  };
}
