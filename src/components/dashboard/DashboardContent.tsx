"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecoverySection } from "@/components/dashboard/RecoverySection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface TemplateSummary {
  id: string;
  name: string;
  createdAt: string;
  _count: { items: number };
}

interface SessionSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  template: { name: string };
  _count: { participants: number };
}

interface DashboardData {
  myTemplates: TemplateSummary[];
  mySessions: SessionSummary[];
  participatedSessions: SessionSummary[];
}

export function DashboardContent() {
  const { userId, isLoading: userLoading } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId, userLoading]);

  if (userLoading || loading) return <Loading />;

  if (!data)
    return (
      <EmptyState title="Could not load dashboard" description="Please try refreshing the page" />
    );

  const isEmpty =
    data.myTemplates.length === 0 &&
    data.mySessions.length === 0 &&
    data.participatedSessions.length === 0;

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">Dashboard</h1>

      {isEmpty && (
        <EmptyState
          title="Nothing here yet"
          description="Create a template or join a session to see your activity here"
        />
      )}

      {/* My Templates */}
      {data.myTemplates.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-neutral-300">My Templates</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.myTemplates.map((t) => (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
              >
                <h3 className="font-medium">{t.name}</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {t._count.items} items &middot; {formatDate(t.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* My Sessions */}
      {data.mySessions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-neutral-300">My Sessions</h2>
          <div className="space-y-3">
            {data.mySessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      {/* Participated Sessions */}
      {data.participatedSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-neutral-300">Participated</h2>
          <div className="space-y-3">
            {data.participatedSessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      {/* Recovery / Cross-device */}
      <RecoverySection />
    </div>
  );
}

function SessionRow({
  session,
}: {
  session: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    template: { name: string };
    _count: { participants: number };
  };
}) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
    >
      <div>
        <h3 className="font-medium">{session.name}</h3>
        <p className="text-sm text-neutral-500">
          {session.template.name} &middot; {session._count.participants} participants &middot;{" "}
          {formatDate(session.createdAt)}
        </p>
      </div>
      <StatusBadge status={session.status} />
    </Link>
  );
}
