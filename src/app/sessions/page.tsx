import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await prisma.session.findMany({
    include: {
      template: { select: { name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link
          href="/sessions/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400"
        >
          + New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-neutral-500">
          <p className="text-lg">No sessions yet</p>
          <p className="text-sm">Create a template first, then start a session</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
            >
              <div>
                <h3 className="font-medium">{session.name}</h3>
                <p className="text-sm text-neutral-500">
                  {session.template.name} &middot;{" "}
                  {session._count.participants} participants &middot;{" "}
                  {formatDate(session.createdAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  session.status === "OPEN"
                    ? "bg-green-500/20 text-green-400"
                    : session.status === "CLOSED"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-neutral-500/20 text-neutral-400"
                }`}
              >
                {session.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
