export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-[var(--fg-muted)]">
      <p className="text-lg">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}
