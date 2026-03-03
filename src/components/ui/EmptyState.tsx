export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center text-neutral-500">
      <p className="text-xl font-medium text-neutral-300">{title}</p>
      <p className="max-w-xl text-base">{description}</p>
    </div>
  );
}
