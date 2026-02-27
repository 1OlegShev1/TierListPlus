"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
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

  const [consensusTiers, setConsensusTiers] = useState<ConsensusTier[]>([]);
  const [participantTiers, setParticipantTiers] = useState<ConsensusTier[] | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantLoading, setParticipantLoading] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ConsensusItem | null>(null);

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

  if (loading) return <Loading message="Loading results..." />;
  if (error) return <ErrorMessage message={error} />;

  const submittedParticipants = session?.participants.filter((p) => p.hasSubmitted) ?? [];
  const totalParticipants = submittedParticipants.length;
  const isIndividualView = !!participantId;
  const displayTiers = participantTiers ?? consensusTiers;

  return (
    <div>
      <PageHeader
        title={`${session?.name} — Results`}
        subtitle={
          isIndividualView
            ? participantName
              ? `${participantName}'s votes`
              : "Loading votes..."
            : `Consensus from ${totalParticipants} submitted voter${totalParticipants !== 1 ? "s" : ""}`
        }
        actions={
          <div className="flex gap-2">
            {isIndividualView && (
              <Link href={`/sessions/${sessionId}/results`} className={buttonVariants.secondary}>
                Back to Consensus
              </Link>
            )}
            <Link href={`/sessions/${sessionId}/vote`} className={buttonVariants.secondary}>
              Back to Vote
            </Link>
          </div>
        }
      />

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
                    onClick={() => !isIndividualView && setSelectedItem(item)}
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
      {!isIndividualView && selectedItem && (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-3 flex items-center gap-3">
            <img
              src={selectedItem.imageUrl}
              alt={selectedItem.label}
              className="h-12 w-12 rounded object-cover"
            />
            <div>
              <h3 className="font-medium">{selectedItem.label}</h3>
              <p className="text-sm text-neutral-500">
                Avg score: {selectedItem.averageScore.toFixed(2)} &middot; {selectedItem.totalVotes}{" "}
                vote{selectedItem.totalVotes !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            {consensusTiers.map((tier) => {
              const count = selectedItem.voteDistribution[tier.key] ?? 0;
              const pct = totalParticipants > 0 ? (count / totalParticipants) * 100 : 0;
              return (
                <div key={tier.key} className="flex items-center gap-2">
                  <span className="w-8 text-right text-xs font-bold" style={{ color: tier.color }}>
                    {tier.label}
                  </span>
                  <div className="flex-1 rounded-full bg-neutral-800 h-4">
                    <div
                      className="h-4 rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: tier.color,
                        minWidth: count > 0 ? "8px" : "0",
                      }}
                    />
                  </div>
                  <span className="w-8 text-xs text-neutral-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Participants */}
      {session && submittedParticipants.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-neutral-400">Individual Votes</h2>
          <div className="flex flex-wrap gap-2">
            {submittedParticipants.map((p) => (
              <Link
                key={p.id}
                href={
                  participantId === p.id
                    ? `/sessions/${sessionId}/results`
                    : `/sessions/${sessionId}/results?participant=${p.id}`
                }
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
