"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, getErrorMessage } from "@/lib/api-client";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";

interface SessionResult {
  name: string;
  participants: { id: string; nickname: string }[];
}

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [tiers, setTiers] = useState<ConsensusTier[]>([]);
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
        setTiers(consensusData);
      })
      .catch((err) => {
        setError(getErrorMessage(err, "Failed to load results. Please try again."));
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <Loading message="Loading results..." />;
  if (error) return <ErrorMessage message={error} />;

  const totalParticipants = session?.participants.length ?? 0;

  return (
    <div>
      <PageHeader
        title={`${session?.name} — Results`}
        subtitle={`Consensus from ${totalParticipants} voter${totalParticipants !== 1 ? "s" : ""}`}
        actions={
          <Link href={`/sessions/${sessionId}`} className={buttonVariants.secondary}>
            Back to Lobby
          </Link>
        }
      />

      {/* Consensus Tier List */}
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        {tiers.map((tier) => (
          <div
            key={tier.key}
            className="flex min-h-[80px] border-b border-neutral-800 last:border-b-0"
          >
            <div
              className="flex w-20 flex-shrink-0 items-center justify-center text-lg font-bold"
              style={{ backgroundColor: tier.color, color: "#000" }}
            >
              {tier.label}
            </div>
            <div className="flex flex-1 flex-wrap items-start gap-1 p-1">
              {tier.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`flex h-[72px] w-[72px] flex-shrink-0 flex-col items-center gap-1 rounded-lg border p-1 transition-colors ${
                    selectedItem?.id === item.id
                      ? "border-amber-400 bg-neutral-700"
                      : "border-neutral-700 bg-neutral-800 hover:border-neutral-500"
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    className="h-[48px] w-[48px] rounded object-cover"
                  />
                  <span className="w-full truncate text-center text-[10px] leading-tight text-neutral-300">
                    {item.label}
                  </span>
                </button>
              ))}
              {tier.items.length === 0 && (
                <span className="flex h-[72px] items-center px-4 text-sm text-neutral-600">
                  No items
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Panel */}
      {selectedItem && (
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
            {tiers.map((tier) => {
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
      {session && session.participants.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-neutral-400">Individual Votes</h2>
          <div className="flex flex-wrap gap-2">
            {session.participants.map((p) => (
              <Link
                key={p.id}
                href={`/sessions/${sessionId}/results?participant=${p.id}`}
                className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 transition-colors hover:border-amber-500 hover:text-amber-400"
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
