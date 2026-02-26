const statusStyles: Record<string, string> = {
  OPEN: "bg-green-500/20 text-green-400",
  CLOSED: "bg-red-500/20 text-red-400",
  ARCHIVED: "bg-neutral-500/20 text-neutral-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${
        statusStyles[status] ?? statusStyles.ARCHIVED
      }`}
    >
      {status}
    </span>
  );
}
