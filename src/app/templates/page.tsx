import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    include: {
      _count: { select: { items: true } },
      items: { take: 4, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Templates"
        actions={
          <Link href="/templates/new" className={buttonVariants.primary}>
            + New Template
          </Link>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first template to get started"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.id}`}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
            >
              <div className="mb-3 grid grid-cols-4 gap-1">
                {template.items.map((item) => (
                  <img
                    key={item.id}
                    src={item.imageUrl}
                    alt={item.label}
                    className="aspect-square w-full rounded object-cover"
                  />
                ))}
                {Array.from({ length: Math.max(0, 4 - template.items.length) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="aspect-square w-full rounded bg-neutral-800"
                    />
                  )
                )}
              </div>
              <h3 className="font-medium">{template.name}</h3>
              <p className="mt-1 text-xs text-neutral-500">
                {template._count.items} items &middot;{" "}
                {formatDate(template.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
