"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, getErrorMessage } from "@/lib/api-client";

interface Series {
  created: number[];
  cumulative: number[];
}

interface AdminStatsResponse {
  generatedAt: string;
  windows: {
    last24hStart: string;
    last7dStart: string;
    seriesStart: string;
    seriesDays: number;
  };
  totals: {
    users: number;
    usersActive7d: number;
    moderators: number;
    admins: number;
    publicTemplatesAvailable: number;
    publicTemplatesModerated: number;
    templates: number;
    sessions: number;
    publicSessionsAvailable: number;
    publicSessionsModerated: number;
    openSessions: number;
    closedSessions: number;
    archivedSessions: number;
    participants: number;
    spaces: number;
    activeDevices7d: number;
    votes: number;
  };
  recent: {
    usersCreated24h: number;
    sessionsCreated24h: number;
    participantsJoined24h: number;
    participantsSubmitted24h: number;
  };
  series: {
    days: string[];
    users: Series;
    sessions: Series;
    publicTemplates: Series;
    participants: Series;
    submissions: Series;
  };
}

type SeriesKey = "users" | "sessions" | "publicTemplates" | "participants" | "submissions";
type TrendMode = "created" | "cumulative";

const RANGE_OPTIONS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

const TREND_MODE_OPTIONS: { value: TrendMode; label: string }[] = [
  { value: "created", label: "New per day" },
  { value: "cumulative", label: "Cumulative" },
];

const TREND_METRICS: { key: SeriesKey; label: string; color: string }[] = [
  { key: "users", label: "Users", color: "#fbbf24" },
  { key: "sessions", label: "Sessions", color: "#38bdf8" },
  { key: "publicTemplates", label: "Public Templates", color: "#34d399" },
  { key: "participants", label: "Participants", color: "#f472b6" },
  { key: "submissions", label: "Submissions", color: "#a78bfa" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function SegmentedToggle<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border-default)] p-0.5">
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-amber-500 text-neutral-950"
              : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-tight text-[var(--fg-primary)]">
        {formatNumber(value)}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{hint}</p> : null}
    </div>
  );
}

function TrendChart({
  label,
  color,
  days,
  values,
  mode,
  rangeDays,
}: {
  label: string;
  color: string;
  days: string[];
  values: number[];
  mode: TrendMode;
  rangeDays: number;
}) {
  const data = days.map((day, i) => ({ day: day.slice(5), value: values[i] ?? 0 }));
  const total =
    mode === "cumulative" ? (values[values.length - 1] ?? 0) : values.reduce((a, b) => a + b, 0);
  const gradientId = `grad-${label.replace(/\s+/g, "")}`;
  const tickInterval = Math.max(0, Math.ceil(days.length / 6) - 1);

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-[var(--fg-primary)]">{label}</p>
        <p className="text-xs text-[var(--fg-muted)]">
          {mode === "cumulative" ? "total" : `${rangeDays}d`}: {formatNumber(total)}
        </p>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" opacity={0.4} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
              interval={tickInterval}
              tickLine={false}
              axisLine={{ stroke: "var(--border-default)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
              tickLine={false}
              axisLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--fg-muted)" }}
              itemStyle={{ color: "var(--fg-primary)" }}
              formatter={(v) => [formatNumber(Number(v)), label]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AdminStatsPage() {
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [trendMode, setTrendMode] = useState<TrendMode>("created");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Stats"
        subtitle={
          data
            ? `Live platform counters · updated ${generatedAtLabel}`
            : "Live platform counters from the local database."
        }
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
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--fg-primary)]">
                Trends (last {rangeDays} days)
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedToggle
                  options={RANGE_OPTIONS.map((range) => ({ value: range, label: `${range}d` }))}
                  value={rangeDays}
                  onChange={setRangeDays}
                />
                <SegmentedToggle
                  options={TREND_MODE_OPTIONS}
                  value={trendMode}
                  onChange={setTrendMode}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TREND_METRICS.map((metric) => (
                <TrendChart
                  key={metric.key}
                  label={metric.label}
                  color={metric.color}
                  days={data.series.days.slice(-rangeDays)}
                  values={data.series[metric.key][trendMode].slice(-rangeDays)}
                  mode={trendMode}
                  rangeDays={rangeDays}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--fg-primary)]">Totals</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              <StatCard
                label="Users"
                value={data.totals.users}
                hint={`${formatNumber(data.totals.usersActive7d)} active (7d)`}
              />
              <StatCard
                label="Staff"
                value={data.totals.admins + data.totals.moderators}
                hint={`${formatNumber(data.totals.admins)} admin / ${formatNumber(data.totals.moderators)} mod`}
              />
              <StatCard label="Active Devices (7d)" value={data.totals.activeDevices7d} />
              <StatCard
                label="Templates"
                value={data.totals.templates}
                hint={`${formatNumber(data.totals.publicTemplatesAvailable)} public`}
              />
              <StatCard
                label="Public Templates (Moderated)"
                value={data.totals.publicTemplatesModerated}
              />
              <StatCard label="Spaces" value={data.totals.spaces} />
              <StatCard
                label="Sessions"
                value={data.totals.sessions}
                hint={`${formatNumber(data.totals.openSessions)} open / ${formatNumber(data.totals.closedSessions)} closed / ${formatNumber(data.totals.archivedSessions)} archived`}
              />
              <StatCard
                label="Public Sessions (Available)"
                value={data.totals.publicSessionsAvailable}
              />
              <StatCard
                label="Public Sessions (Moderated)"
                value={data.totals.publicSessionsModerated}
              />
              <StatCard label="Participants" value={data.totals.participants} />
              <StatCard label="Votes Cast" value={data.totals.votes} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--fg-primary)]">Last 24 hours</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="New Users" value={data.recent.usersCreated24h} />
              <StatCard label="New Sessions" value={data.recent.sessionsCreated24h} />
              <StatCard label="Participants Joined" value={data.recent.participantsJoined24h} />
              <StatCard label="Submissions" value={data.recent.participantsSubmitted24h} />
            </div>
          </section>
        </div>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">No data available.</p>
      )}
    </div>
  );
}
