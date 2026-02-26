import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-sm text-neutral-400">
              {template.description}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            href={`/templates/${templateId}/edit`}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Edit
          </Link>
          <Link
            href={`/sessions/new?templateId=${templateId}`}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400"
          >
            Start Session
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {template.items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-2"
          >
            <img
              src={item.imageUrl}
              alt={item.label}
              className="aspect-square w-full rounded object-cover"
            />
            <p className="mt-1 truncate text-center text-xs text-neutral-300">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
