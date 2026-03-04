"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";
import { ReopenVoteButton } from "@/components/sessions/ReopenVoteButton";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParticipant } from "@/hooks/useParticipant";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import type { SessionResult } from "@/types";

const DETAILS_PANEL_ANIMATION_MS = 240;
const MAX_TIER_TOOLTIP_NAMES = 4;

function formatTierVoterPreview(names: string[]): string {
  const visibleNames = names.slice(0, MAX_TIER_TOOLTIP_NAMES);
  const hiddenCount = names.length - visibleNames.length;
  const preview = visibleNames.join(", ");

  if (hiddenCount <= 0) return preview;
  return `${preview}, +${hiddenCount} more`;
}

export function ResultsPageClient({
  sessionId,
  initialSession,
  initialConsensusTiers,
  participantId,
  initialParticipantName,
  initialParticipantTiers,
  initialParticipantError,
}: {
  sessionId: string;
  initialSession: SessionResult;
  initialConsensusTiers: ConsensusTier[];
  participantId: string | null;
  initialParticipantName: string | null;
  initialParticipantTiers: ConsensusTier[] | null;
  initialParticipantError: string | null;
}) {
  const { save: saveParticipant, clear: clearParticipant } = useParticipant(sessionId);
  const [session, setSession] = useState(initialSession);
  const [selectedItem, setSelectedItem] = useState<ConsensusItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<ConsensusItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isTouchInput, setIsTouchInput] = useState(false);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const wasDetailsOpenRef = useRef(false);
  const touchStartRef = useRef<{ id: string; x: number; y: number } | null>(null);

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
    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => {
      const hasTouch = navigator.maxTouchPoints > 0;
      setIsTouchInput(media.matches || hasTouch);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const justOpened = detailsOpen && !wasDetailsOpenRef.current;
    wasDetailsOpenRef.current = detailsOpen;

    if (!justOpened || !detailsItem || participantId || initialParticipantError) {
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const panel = detailsPanelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const topOffset = isTouchInput ? 68 : 88;
        const bottomBuffer = isTouchInput ? 20 : 28;

        const needsScroll =
          rect.top < topOffset ||
          rect.top > viewportHeight - 120 ||
          rect.bottom > viewportHeight - bottomBuffer;

        if (!needsScroll) return;
        panel.scrollIntoView({
          behavior: isTouchInput ? "auto" : "smooth",
          block: "start",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [detailsItem, detailsOpen, initialParticipantError, isTouchInput, participantId]);

  useEffect(() => {
    if (participantId) {
      setDetailsOpen(false);
      setDetailsItem(null);
      return;
    }

    if (selectedItem) {
      setDetailsItem(selectedItem);
      const raf = window.requestAnimationFrame(() => {
        setDetailsOpen(true);
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setDetailsOpen(false);
    const timeout = window.setTimeout(() => {
      setDetailsItem(null);
    }, DETAILS_PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [participantId, selectedItem]);

  const participantsWithSavedVotes = session.participants.filter((p) => p.hasSavedVotes);
  const totalParticipants = participantsWithSavedVotes.length;
  const selectedParticipant =
    participantsWithSavedVotes.find((p) => p.id === participantId) ?? null;
  const currentParticipantId = session.currentParticipantId;
  const isIndividualView = !!participantId;
  const displayTiers = initialParticipantTiers ?? initialConsensusTiers;
  const consensusLabel = `Everyone (${totalParticipants})`;
  const baseSubtitle = isIndividualView
    ? initialParticipantName
      ? `${initialParticipantName}'s ballot`
      : selectedParticipant
        ? `${selectedParticipant.nickname}'s ballot`
        : "That ballot"
    : `${consensusLabel} together`;
  const subtitle = <span>{baseSubtitle}</span>;
  const voteHref = currentParticipantId
    ? `/sessions/${sessionId}/vote`
    : `/sessions/join?code=${encodeURIComponent(session.joinCode)}`;

  const handleItemSelect = (item: ConsensusItem) => {
    if (isIndividualView) return;
    setSelectedItem((current) => (current?.id === item.id ? null : item));
  };

  return (
    <div>
      <PageHeader
        title={`${session.name} Rankings`}
        subtitle={subtitle}
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
            {session.status === "OPEN" && (
              <>
                <Link
                  href={voteHref}
                  className={`${buttonVariants.primary} !px-4 !py-1.5 !text-sm whitespace-nowrap`}
                >
                  <span className="sm:hidden">{currentParticipantId ? "Resume" : "Join"}</span>
                  <span className="hidden sm:inline">
                    {currentParticipantId ? "Jump Back In" : "Join This Vote"}
                  </span>
                </Link>
                <CloseVoteButton
                  sessionId={sessionId}
                  creatorId={session.creatorId}
                  status={session.status}
                  label="Close"
                  onClosed={() =>
                    setSession((current) => (current ? { ...current, status: "CLOSED" } : current))
                  }
                />
              </>
            )}
            {session.status !== "OPEN" && (
              <>
                <Link
                  href="/sessions"
                  className={`${buttonVariants.secondary} !px-4 !py-1.5 !text-sm whitespace-nowrap`}
                >
                  <span className="sm:hidden">Back</span>
                  <span className="hidden sm:inline">Back to Votes</span>
                </Link>
                <ReopenVoteButton
                  sessionId={sessionId}
                  creatorId={session.creatorId}
                  status={session.status}
                  label="Reopen"
                  onReopened={() =>
                    setSession((current) => (current ? { ...current, status: "OPEN" } : current))
                  }
                />
              </>
            )}
          </div>
        }
      />

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">See</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/sessions/${sessionId}/results`}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              !isIndividualView
                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                : "border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-400"
            }`}
          >
            {consensusLabel}
          </Link>
          {participantsWithSavedVotes.map((participant) => (
            <Link
              key={participant.id}
              href={`/sessions/${sessionId}/results?participant=${participant.id}`}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                participantId === participant.id
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-400"
              }`}
            >
              {participant.nickname}
              {!participant.isComplete && participant.missingItemCount > 0
                ? ` (${participant.missingItemCount} left)`
                : ""}
            </Link>
          ))}
        </div>
      </div>

      {initialParticipantError && <ErrorMessage message={initialParticipantError} />}

      {!initialParticipantError && (
        <div className="overflow-hidden rounded-lg border border-neutral-800 touch-pan-y">
          {displayTiers.map((tier) => (
            <div
              key={tier.key}
              className="flex min-h-[72px] border-b border-neutral-800 last:border-b-0 sm:min-h-[80px] md:min-h-[90px] lg:min-h-[104px]"
            >
              <div
                className="flex w-20 flex-shrink-0 items-center justify-center px-2 py-2 text-center text-sm font-bold sm:w-24 sm:px-3 sm:text-base md:w-28 md:text-lg lg:w-32 lg:text-xl"
                style={{ backgroundColor: tier.color, color: "#000" }}
                title={tier.label}
              >
                <span className="block max-w-full text-[11px] leading-tight line-clamp-2 break-words sm:text-base sm:line-clamp-none md:text-lg lg:text-xl">
                  {tier.label}
                </span>
              </div>
              <div className="flex flex-1 touch-pan-y flex-wrap items-start gap-1 p-1 sm:gap-1.5 sm:p-1.5 md:gap-2 md:p-2">
                {tier.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!isTouchInput) handleItemSelect(item);
                    }}
                    onTouchStart={(event) => {
                      if (isIndividualView || !isTouchInput) return;
                      const touch = event.touches[0];
                      if (!touch) return;
                      touchStartRef.current = { id: item.id, x: touch.clientX, y: touch.clientY };
                    }}
                    onTouchEnd={(event) => {
                      if (isIndividualView || !isTouchInput) return;
                      const touch = event.changedTouches[0];
                      const start = touchStartRef.current;
                      touchStartRef.current = null;
                      if (!touch || !start || start.id !== item.id) return;
                      const movedX = Math.abs(touch.clientX - start.x);
                      const movedY = Math.abs(touch.clientY - start.y);
                      if (movedX > 8 || movedY > 8) return;
                      event.preventDefault();
                      handleItemSelect(item);
                    }}
                    onTouchCancel={() => {
                      touchStartRef.current = null;
                    }}
                    className={`group relative h-[62px] w-[62px] flex-shrink-0 overflow-hidden rounded-md border transition-colors sm:h-[70px] sm:w-[70px] md:h-[78px] md:w-[78px] lg:h-[96px] lg:w-[96px] ${
                      !isIndividualView && selectedItem?.id === item.id
                        ? "border-amber-400 ring-2 ring-amber-400"
                        : "border-neutral-700 hover:border-neutral-500"
                    } ${isIndividualView ? "cursor-default" : "cursor-pointer touch-manipulation"}`}
                  >
                    <ItemArtwork
                      src={item.imageUrl}
                      alt={item.label}
                      className="h-full w-full"
                      presentation="ambient"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100">
                      {item.label}
                    </span>
                  </button>
                ))}
                {tier.items.length === 0 && (
                  <span className="flex h-[60px] items-center px-2 text-xs text-neutral-600 sm:h-[70px] sm:px-2.5 md:h-[84px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm">
                    No picks
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isIndividualView && detailsItem && (
        <div
          ref={detailsPanelRef}
          className={`mt-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/60 transition-[opacity,transform,max-height,margin] duration-200 ease-out ${
            detailsOpen
              ? "max-h-[32rem] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
          }`}
        >
          <div className="border-b border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-neutral-800">
                <ItemArtwork
                  src={detailsItem.imageUrl}
                  alt={detailsItem.label}
                  className="h-full w-full"
                  presentation="ambient"
                />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-neutral-100">
                  {detailsItem.label}
                </h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Average score {detailsItem.averageScore.toFixed(2)} from {detailsItem.totalVotes}{" "}
                  vote{detailsItem.totalVotes !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div>
              <h4 className="mb-3 text-sm font-medium text-neutral-300">Placement breakdown</h4>
              <div className="space-y-2 px-4 py-3">
                {initialConsensusTiers.map((tier) => {
                  const count = detailsItem.voteDistribution[tier.key] ?? 0;
                  const voterNames = detailsItem.voterNicknamesByTier[tier.key] ?? [];
                  const tooltipPreview =
                    voterNames.length > 0 ? formatTierVoterPreview(voterNames) : null;
                  const pct =
                    detailsItem.totalVotes > 0
                      ? Math.min(100, (count / detailsItem.totalVotes) * 100)
                      : 0;
                  const pctRounded = Math.round(pct);

                  return (
                    <div
                      key={tier.key}
                      className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 sm:grid-cols-[6rem_1fr_auto] md:grid-cols-[7rem_1fr_auto] md:gap-4 lg:grid-cols-[8rem_1fr_auto]"
                    >
                      <span
                        className="inline-flex h-7 w-full items-center justify-center overflow-hidden rounded px-2 py-1 text-xs font-bold"
                        style={{ backgroundColor: tier.color, color: "#000" }}
                        title={tier.label}
                      >
                        <span className="block w-full truncate text-center leading-none">
                          {tier.label}
                        </span>
                      </span>
                      <div className="group relative">
                        <div className="relative h-3 overflow-hidden rounded-full border border-neutral-700/80 bg-neutral-900">
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-30"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 6px, transparent 6px, transparent 12px)",
                            }}
                          />
                          <div
                            className="relative h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: tier.color,
                              boxShadow: `0 0 0 1px ${tier.color}80 inset, 0 0 10px ${tier.color}55`,
                              minWidth: count > 0 ? "10px" : "0",
                            }}
                          />
                        </div>
                        {!isTouchInput && tooltipPreview && (
                          <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 max-w-xs translate-y-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-left text-xs text-neutral-200 opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                            <span className="block font-medium text-neutral-100">
                              {tooltipPreview}
                            </span>
                            <span className="mt-1 block text-[11px] text-neutral-400">
                              {count} vote{count !== 1 ? "s" : ""} in {tier.label}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="w-16 text-right text-xs tabular-nums text-neutral-400">
                        {count} · {pctRounded}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
