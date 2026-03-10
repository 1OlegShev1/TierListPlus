const statusStyles: Record<string, string> = {
  OPEN: "bg-[var(--state-success-bg)] text-[var(--state-success-fg)]",
  CLOSED: "bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)]",
  ARCHIVED: "bg-[var(--state-muted-bg)] text-[var(--state-muted-fg)]",
};

const statusLabels: Record<string, string> = {
  OPEN: "Live",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
        statusStyles[status] ?? statusStyles.ARCHIVED
      }`}
    >
      {statusLabels[status] ?? statusLabels.ARCHIVED}
    </span>
  );
}
