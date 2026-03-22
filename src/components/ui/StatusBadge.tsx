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
      className={`rounded-full px-3 py-1 text-xs font-medium sm:px-4 sm:py-1.5 sm:text-sm ${
        statusStyles[status] ?? statusStyles.ARCHIVED
      }`}
    >
      {statusLabels[status] ?? statusLabels.ARCHIVED}
    </span>
  );
}
