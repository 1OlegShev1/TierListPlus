export function formatCompactVoteDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "----/--/--";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildMobileVoteMetaLine({
  itemCount,
  participantCount,
  updatedAt,
}: {
  itemCount: number;
  participantCount: number;
  updatedAt: Date | string;
}) {
  return `${itemCount}p · ${participantCount}j · ${formatCompactVoteDate(updatedAt)}`;
}
