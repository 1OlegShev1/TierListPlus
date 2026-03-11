"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, getErrorMessage } from "@/lib/api-client";

interface AdminStatsResponse {
  generatedAt: string;
  windows: {
    last24hStart: string;
    last7dStart: string;
  };
  totals: {
    users: number;
    usersActive7d: number;
    publicTemplatesAvailable: number;
    publicTemplatesModerated: number;
    sessions: number;
    publicSessionsAvailable: number;
    publicSessionsModerated: number;
    openSessions: number;
    participants: number;
  };
  recent: {
    usersCreated24h: number;
    usersCreated7d: number;
    publicTemplatesCreated7d: number;
    sessionsCreated24h: number;
    sessionsCreated7d: number;
    participantsJoined7d: number;
    participantsSubmitted7d: number;
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--fg-primary)]">{formatNumber(value)}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--fg-muted)]">{hint}</p> : null}
    </div>
  );
}

export function AdminStatsPage() {
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");

    try {
      const result = await apiFetch<AdminStatsResponse>("/api/admin/stats", { cache: "no-store" });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load admin stats"));
    } finally {
      if (mode === "initial") {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStats("initial");
  }, [loadStats]);

  const generatedAtLabel = useMemo(() => (data ? formatDate(data.generatedAt) : "-"), [data]);
  const windowLabel = useMemo(() => {
    if (!data) return "-";
    return `${formatDate(data.windows.last7dStart)} -> ${generatedAtLabel}`;
  }, [data, generatedAtLabel]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Stats"
        subtitle="Live platform counters from the local database."
        actions={
          <Button
            variant="secondary"
            onClick={() => loadStats("refresh")}
            disabled={loading || refreshing}
            className="!rounded-xl !px-4 !py-2 !text-sm"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? (
        <Loading message="Loading admin stats..." />
      ) : data ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 sm:p-5">
            <p className="text-sm text-[var(--fg-muted)]">
              Generated:{" "}
              <span className="font-medium text-[var(--fg-primary)]">{generatedAtLabel}</span>
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              7-day window:{" "}
              <span className="font-medium text-[var(--fg-primary)]">{windowLabel}</span>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--fg-primary)]">Totals</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Users" value={data.totals.users} />
              <StatCard label="Active Users (7d)" value={data.totals.usersActive7d} />
              <StatCard
                label="Public Lists (Available)"
                value={data.totals.publicTemplatesAvailable}
              />
              <StatCard
                label="Public Lists (Moderated)"
                value={data.totals.publicTemplatesModerated}
              />
              <StatCard label="Sessions" value={data.totals.sessions} />
              <StatCard
                label="Public Sessions (Available)"
                value={data.totals.publicSessionsAvailable}
              />
              <StatCard
                label="Public Sessions (Moderated)"
                value={data.totals.publicSessionsModerated}
              />
              <StatCard label="Open Sessions" value={data.totals.openSessions} />
              <StatCard label="Participants" value={data.totals.participants} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--fg-primary)]">Recent Activity</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Users Created (24h)" value={data.recent.usersCreated24h} />
              <StatCard label="Users Created (7d)" value={data.recent.usersCreated7d} />
              <StatCard
                label="Public Lists Created (7d)"
                value={data.recent.publicTemplatesCreated7d}
              />
              <StatCard label="Sessions Created (24h)" value={data.recent.sessionsCreated24h} />
              <StatCard label="Sessions Created (7d)" value={data.recent.sessionsCreated7d} />
              <StatCard label="Participants Joined (7d)" value={data.recent.participantsJoined7d} />
              <StatCard
                label="Participants Submitted (7d)"
                value={data.recent.participantsSubmitted7d}
              />
            </div>
          </section>
        </div>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">No data available.</p>
      )}
    </div>
  );
}
