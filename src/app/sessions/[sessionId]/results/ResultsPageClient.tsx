"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/ItemSourceModal";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";
import { ReopenVoteButton } from "@/components/sessions/ReopenVoteButton";
import { buttonSizes, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParticipant } from "@/hooks/useParticipant";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import type { SessionResult } from "@/types";
import { BrowsePanel } from "./BrowsePanel";
import { BrowseResultsSection } from "./BrowseResultsSection";
import { EveryoneResultsSection } from "./EveryoneResultsSection";
import { buildResultsHref, type ResultsView } from "./resultsViewModel";
import { useBrowseResultsState } from "./useBrowseResultsState";
import { useResultsDetailsPanel } from "./useResultsDetailsPanel";

function findConsensusItemById(tiers: ConsensusTier[] | null, itemId: string | null) {
  if (!tiers || !itemId) return null;
  for (const tier of tiers) {
    const match = tier.items.find((item) => item.id === itemId);
    if (match) return match;
  }
  return null;
}

function ContextCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-4 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        Showing
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-neutral-50 sm:text-[1.75rem]">{title}</h2>
      <p className="mt-2 text-sm text-neutral-400 sm:text-base">{description}</p>
    </div>
  );
}

function ViewToggle({ sessionId, activeView }: { sessionId: string; activeView: ResultsView }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {[
        {
          label: "Everyone",
          href: buildResultsHref({ sessionId, view: "everyone" }),
          active: activeView === "everyone",
        },
        {
          label: "Browse",
          href: buildResultsHref({ sessionId, view: "browse" }),
          active: activeView === "browse",
        },
      ].map((option) => (
        <Link
          key={option.label}
          href={option.href}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            option.active
              ? "border-amber-500 bg-amber-500/10 text-amber-300"
              : "border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-300"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

export function ResultsPageClient({
  sessionId,
  initialSession,
  initialConsensusTiers,
  initialView,
  participantId,
  compareParticipantId,
  compareEveryone,
  canViewIndividualBallots,
  initialParticipantName,
  initialParticipantTiers,
  initialParticipantError,
  initialCompareParticipantName,
  initialCompareParticipantTiers,
  initialCompareParticipantError,
}: {
  sessionId: string;
  initialSession: SessionResult;
  initialConsensusTiers: ConsensusTier[];
  initialView: ResultsView;
  participantId: string | null;
  compareParticipantId: string | null;
  compareEveryone: boolean;
  canViewIndividualBallots: boolean;
  initialParticipantName: string | null;
  initialParticipantTiers: ConsensusTier[] | null;
  initialParticipantError: string | null;
  initialCompareParticipantName: string | null;
  initialCompareParticipantTiers: ConsensusTier[] | null;
  initialCompareParticipantError: string | null;
}) {
  const { save: saveParticipant, clear: clearParticipant } = useParticipant(sessionId);
  const [session, setSession] = useState(initialSession);
  const [sourceModalItem, setSourceModalItem] = useState<ConsensusItem | null>(null);
  const [compareLeftExpandedItemId, setCompareLeftExpandedItemId] = useState<string | null>(null);
  const [compareRightExpandedItemId, setCompareRightExpandedItemId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const compareSelectionKeyRef = useRef(
    `${participantId ?? "none"}:${compareParticipantId ?? "none"}:${compareEveryone ? "everyone" : "no-everyone"}`,
  );

  const {
    selectedItem,
    detailsItem,
    detailsOpen,
    detailsPanelRef,
    isTouchInput,
    handleItemToggle,
    handleItemClick,
    handleItemTouchStart,
    handleItemTouchEnd,
    handleItemTouchCancel,
  } = useResultsDetailsPanel({
    participantId,
    initialParticipantError,
  });

  useEffect(() => {
    if (session.currentParticipantId && session.currentParticipantNickname) {
      saveParticipant(session.currentParticipantId, session.currentParticipantNickname);
      return;
    }
    clearParticipant();
  }, [
    clearParticipant,
    saveParticipant,
    session.currentParticipantId,
    session.currentParticipantNickname,
  ]);

  useEffect(() => {
    const nextKey = `${participantId ?? "none"}:${compareParticipantId ?? "none"}:${compareEveryone ? "everyone" : "no-everyone"}`;
    if (compareSelectionKeyRef.current === nextKey) return;
    compareSelectionKeyRef.current = nextKey;
    setCompareLeftExpandedItemId(null);
    setCompareRightExpandedItemId(null);
  }, [participantId, compareParticipantId, compareEveryone]);

  const {
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
    toggleBrowserOpen,
    viewState,
  } = useBrowseResultsState({
    sessionId,
    canViewIndividualBallots,
    initialView,
    participants: session.participants,
    currentParticipantId: session.currentParticipantId,
    participantId,
    compareParticipantId,
    compareEveryone,
    initialParticipantName,
    initialCompareParticipantName,
    initialParticipantTiers,
    initialCompareParticipantTiers,
  });

  const currentParticipantId = session.currentParticipantId;
  const voteHref = currentParticipantId
    ? `/sessions/${sessionId}/vote`
    : `/sessions/join?code=${encodeURIComponent(session.joinCode)}`;
  const primaryVoteActionLabel = currentParticipantId ? "Resume" : "Join vote";
  const backToVotesHref = session.spaceId ? `/spaces/${session.spaceId}` : "/sessions";
  const backToVotesLabel = session.spaceId ? "Back to Space Votes" : "Back to Votes";

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const compareLeftSelectedItem = findConsensusItemById(
    initialParticipantTiers,
    compareLeftExpandedItemId,
  );
  const compareRightTiers = hasEveryoneCompareSelection
    ? initialConsensusTiers
    : initialCompareParticipantTiers;
  const compareRightSelectedItem = findConsensusItemById(
    compareRightTiers,
    compareRightExpandedItemId,
  );
  const handleCompareLeftToggle = (item: ConsensusItem) => {
    setCompareLeftExpandedItemId((current) => (current === item.id ? null : item.id));
  };
  const handleCompareRightToggle = (item: ConsensusItem) => {
    setCompareRightExpandedItemId((current) => (current === item.id ? null : item.id));
  };

  return (
    <div>
      <Link
        href={backToVotesHref}
        className={`${buttonVariants.ghost} mb-2 inline-flex items-center sm:mb-3`}
      >
        {`← ${backToVotesLabel}`}
      </Link>
      <PageHeader
        title={`${session.name} Rankings`}
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
            {session.status === "OPEN" && (
              <>
                <Link
                  href={voteHref}
                  className={`${buttonVariants.primary} ${buttonSizes.equalAction} !min-w-0 whitespace-nowrap`}
                >
                  {primaryVoteActionLabel}
                </Link>
                <CloseVoteButton
                  sessionId={sessionId}
                  creatorId={session.creatorId}
                  status={session.status}
                  canManageOverride={session.canManageSession}
                  label="End"
                  className={`${buttonSizes.equalAction} min-w-0`}
                  onClosed={() =>
                    setSession((current) => (current ? { ...current, status: "CLOSED" } : current))
                  }
                />
              </>
            )}
            {session.status !== "OPEN" && (
              <ReopenVoteButton
                sessionId={sessionId}
                creatorId={session.creatorId}
                status={session.status}
                canManageOverride={session.canManageSession}
                label="Reopen"
                onReopened={() =>
                  setSession((current) => (current ? { ...current, status: "OPEN" } : current))
                }
              />
            )}
          </div>
        }
      />

      {canViewIndividualBallots ? (
        <ViewToggle sessionId={sessionId} activeView={viewState.activeView} />
      ) : (
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-400">
          Shared results view. Individual ballots are hidden.
        </div>
      )}

      {!viewState.isBrowseView && (
        <ContextCard title={viewState.contextTitle} description={viewState.contextDescription} />
      )}

      {viewState.isBrowseView && canViewIndividualBallots && (
        <BrowsePanel
          title={viewState.browseHeaderTitle}
          isOpen={isBrowserOpen}
          onToggleOpen={toggleBrowserOpen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery("")}
          stopComparingHref={stopComparingHref}
          clearSelectionHref={clearSelectionHref}
          compareWithEveryoneHref={compareWithEveryoneHref}
          listHeightClass={viewState.browserListHeightClass}
          rows={browseRows}
          onScrollToResults={scrollToResults}
        />
      )}

      {initialParticipantError && <ErrorMessage message={initialParticipantError} />}
      {initialCompareParticipantError && <ErrorMessage message={initialCompareParticipantError} />}

      {!viewState.isBrowseView && !initialParticipantError && (
        <EveryoneResultsSection
          resultsRef={resultsRef}
          consensusTiers={initialConsensusTiers}
          selectedItem={selectedItem}
          onItemToggle={handleItemToggle}
          onItemClick={handleItemClick}
          onItemTouchStart={handleItemTouchStart}
          onItemTouchEnd={handleItemTouchEnd}
          onItemTouchCancel={handleItemTouchCancel}
          detailsItem={detailsItem}
          detailsOpen={detailsOpen}
          detailsPanelRef={detailsPanelRef}
          isTouchInput={isTouchInput}
          onOpenSource={(item) => setSourceModalItem(item)}
        />
      )}

      {viewState.isBrowseView &&
        hasPrimarySelection &&
        !initialParticipantError &&
        initialParticipantTiers && (
          <BrowseResultsSection
            resultsRef={resultsRef}
            hasCompareSelection={hasCompareSelection}
            hasEveryoneCompareSelection={hasEveryoneCompareSelection}
            initialParticipantName={initialParticipantName}
            selectedNickname={selectedParticipant?.nickname ?? null}
            initialParticipantTiers={initialParticipantTiers}
            initialCompareParticipantName={initialCompareParticipantName}
            comparedNickname={comparedParticipant?.nickname ?? null}
            compareRightTiers={compareRightTiers}
            compareLeftSelectedItem={compareLeftSelectedItem}
            compareRightSelectedItem={compareRightSelectedItem}
            selectedItem={selectedItem}
            onCompareLeftToggle={handleCompareLeftToggle}
            onCompareRightToggle={handleCompareRightToggle}
            onItemToggle={handleItemToggle}
            onOpenSource={(item) => setSourceModalItem(item)}
          />
        )}

      {sourceModalItem && (
        <ItemSourceModal
          open
          itemLabel={sourceModalItem.label || "Untitled item"}
          itemImageUrl={sourceModalItem.imageUrl}
          sourceUrl={sourceModalItem.sourceUrl}
          sourceProvider={sourceModalItem.sourceProvider}
          sourceNote={sourceModalItem.sourceNote}
          sourceStartSec={sourceModalItem.sourceStartSec}
          sourceEndSec={sourceModalItem.sourceEndSec}
          editable={false}
          onClose={() => setSourceModalItem(null)}
        />
      )}
    </div>
  );
}
