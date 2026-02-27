import { cookies } from "next/headers";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/user-session";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;

  const sessions = await prisma.session.findMany({
    where: userId
      ? {
          OR: [{ creatorId: userId }, { participants: { some: { userId } } }, { isPrivate: false }],
        }
      : { isPrivate: false },
    include: {
      template: { select: { name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Sessions"
        actions={
          <Link href="/sessions/new" className={buttonVariants.primary}>
            + New Session
          </Link>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Create a template first, then start a session"
        />
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
                  {session.template.name} &middot; {session._count.participants} participants
                  &middot; {formatDate(session.createdAt)}
                </p>
              </div>
              <StatusBadge status={session.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
