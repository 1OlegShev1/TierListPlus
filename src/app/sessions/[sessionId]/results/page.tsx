"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParticipant } from "@/hooks/useParticipant";
import { apiFetch, getErrorMessage } from "@/lib/api-client";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import type { Item, SessionResult, TierConfig } from "@/types";

interface ParticipantVote {
  tierKey: string;
  rankInTier: number;
  sessionItem: Item;
}

interface ParticipantVotesResponse {
  participant: { id: string; nickname: string };
  votes: ParticipantVote[];
}

const DETAILS_PANEL_ANIMATION_MS = 240;

/** Build display tiers from a single participant's votes */
function buildParticipantTiers(
  votes: ParticipantVote[],
  tierConfig: TierConfig[],
): ConsensusTier[] {
  const grouped = new Map<string, ParticipantVote[]>();
  for (const tier of tierConfig) {
    grouped.set(tier.key, []);
  }
  for (const vote of votes) {
    const bucket = grouped.get(vote.tierKey);
    if (bucket) bucket.push(vote);
  }
  return tierConfig.map((tier) => ({
    ...tier,
    items: (grouped.get(tier.key) ?? [])
      .sort((a, b) => a.rankInTier - b.rankInTier)
      .map((v) => ({
        ...v.sessionItem,
        averageScore: 0,
        voteDistribution: {},
        totalVotes: 0,
      })),
  }));
}

function ResultsContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const participantId = searchParams.get("participant");
  const { participantId: localParticipantId } = useParticipant(sessionId);

  const [consensusTiers, setConsensusTiers] = useState<ConsensusTier[]>([]);
  const [participantTiers, setParticipantTiers] = useState<ConsensusTier[] | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantLoading, setParticipantLoading] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ConsensusItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<ConsensusItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<SessionResult>(`/api/sessions/${sessionId}`),
      apiFetch<ConsensusTier[]>(`/api/sessions/${sessionId}/votes/consensus`),
    ])
      .then(([sessionData, consensusData]) => {
        setSession(sessionData);
        setConsensusTiers(consensusData);
      })
      .catch((err) => {
        setError(getErrorMessage(err, "Failed to load results. Please try again."));
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!participantId || !session) {
      setParticipantTiers(null);
      setParticipantName(null);
      setParticipantError(null);
      setParticipantLoading(false);
      return;
    }

    let stale = false;
    setSelectedItem(null);
    setParticipantLoading(true);
    setParticipantError(null);

    apiFetch<ParticipantVotesResponse>(`/api/sessions/${sessionId}/votes/${participantId}`)
      .then((data) => {
        if (stale) return;
        setParticipantName(data.participant.nickname);
        setParticipantTiers(buildParticipantTiers(data.votes, session.tierConfig));
      })
      .catch((err) => {
        if (stale) return;
        setParticipantError(getErrorMessage(err, "Failed to load participant votes."));
        setParticipantTiers(null);
        setParticipantName(null);
      })
      .finally(() => {
        if (!stale) setParticipantLoading(false);
      });

    return () => {
      stale = true;
    };
  }, [participantId, session, sessionId]);

  useEffect(() => {
    if (!detailsItem || !detailsOpen || participantId || participantLoading || participantError) {
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      detailsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [detailsItem, detailsOpen, participantError, participantId, participantLoading]);

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

  if (loading) return <Loading message="Loading results..." />;
  if (error) return <ErrorMessage message={error} />;

  const submittedParticipants = session?.participants.filter((p) => p.hasSubmitted) ?? [];
  const totalParticipants = submittedParticipants.length;
  const isIndividualView = !!participantId;
  const displayTiers = participantTiers ?? consensusTiers;
  const consensusLabel = `Consensus (${totalParticipants})`;

  return (
    <div>
      <PageHeader
        title={`${session?.name} — Results`}
        subtitle={
          isIndividualView
            ? participantName
              ? `Viewing ${participantName}'s votes`
              : "Loading votes..."
            : `Viewing ${consensusLabel}`
        }
        actions={
          <div className="flex gap-2">
            {session?.status === "OPEN" && (
              <Link href={`/sessions/${sessionId}`} className={buttonVariants.primary}>
                {localParticipantId ? "Edit My Vote" : "Join to Vote"}
              </Link>
            )}
            {session?.status !== "OPEN" && (
              <Link href="/sessions" className={buttonVariants.secondary}>
                Back to Sessions
              </Link>
            )}
          </div>
        }
      />

      {/* View selector */}
      {session && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-neutral-400">View By</h2>
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
            {submittedParticipants.map((p) => (
              <Link
                key={p.id}
                href={`/sessions/${sessionId}/results?participant=${p.id}`}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  participantId === p.id
                    ? "border-amber-500 bg-amber-500/10 text-amber-400"
                    : "border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-400"
                }`}
              >
                {p.nickname}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Participant loading/error */}
      {participantLoading && <Loading message="Loading votes..." />}
      {participantError && <ErrorMessage message={participantError} />}

      {/* Tier List */}
      {!participantLoading && !participantError && (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          {displayTiers.map((tier) => (
            <div
              key={tier.key}
              className="flex min-h-[104px] border-b border-neutral-800 last:border-b-0"
            >
              <div
                className="flex w-28 flex-shrink-0 items-center justify-center px-2 text-center text-xl font-bold"
                style={{ backgroundColor: tier.color, color: "#000" }}
              >
                {tier.label}
              </div>
              <div className="flex flex-1 flex-wrap items-start gap-2 p-2">
                {tier.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      !isIndividualView &&
                      setSelectedItem((current) => (current?.id === item.id ? null : item))
                    }
                    className={`group relative h-[96px] w-[96px] flex-shrink-0 overflow-hidden rounded-md border transition-colors ${
                      !isIndividualView && selectedItem?.id === item.id
                        ? "border-amber-400 ring-2 ring-amber-400"
                        : "border-neutral-700 hover:border-neutral-500"
                    } ${isIndividualView ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100">
                      {item.label}
                    </span>
                  </button>
                ))}
                {tier.items.length === 0 && (
                  <span className="flex h-[96px] items-center px-4 text-sm text-neutral-600">
                    No items
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Detail Panel (consensus view only) */}
      {!isIndividualView && detailsItem && (
        <div
          ref={detailsPanelRef}
          className={`scroll-mt-6 transition-all duration-[240ms] ease-in-out ${
            detailsOpen ? "mt-6 opacity-100 translate-y-0" : "mt-2 opacity-0 -translate-y-1"
          }`}
        >
          <div
            className={`grid overflow-hidden transition-[grid-template-rows] duration-[240ms] ease-in-out ${
              detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0">
              <div className="overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950">
                <div className="flex items-center justify-between border-b border-neutral-800/80 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={detailsItem.imageUrl}
                      alt={detailsItem.label}
                      className="h-12 w-12 rounded-md border border-neutral-700 object-cover"
                    />
                    <div>
                      <h3 className="font-medium">{detailsItem.label}</h3>
                      <p className="text-sm text-neutral-400">
                        Avg score: {detailsItem.averageScore.toFixed(2)} &middot;{" "}
                        {detailsItem.totalVotes} vote{detailsItem.totalVotes !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-400">
                    Vote Distribution
                  </span>
                </div>

                <div className="space-y-2 px-4 py-3">
                  {consensusTiers.map((tier) => {
                    const count = detailsItem.voteDistribution[tier.key] ?? 0;
                    const pct =
                      detailsItem.totalVotes > 0
                        ? Math.min(100, (count / detailsItem.totalVotes) * 100)
                        : 0;
                    const pctRounded = Math.round(pct);
                    return (
                      <div
                        key={tier.key}
                        className="grid grid-cols-[3rem_1fr_auto] items-center gap-3"
                      >
                        <span
                          className="inline-flex h-6 w-10 items-center justify-center rounded text-xs font-bold"
                          style={{ backgroundColor: tier.color, color: "#000" }}
                        >
                          {tier.label}
                        </span>
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
                        <span className="w-14 text-right text-xs tabular-nums text-neutral-400">
                          {count} · {pctRounded}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<Loading message="Loading results..." />}>
      <ResultsContent />
    </Suspense>
  );
}
