import { MAX_SOURCE_INTERVAL_SECONDS } from "@/lib/item-source";

export function parseOptionalTimeToSeconds(
  value: string,
): number | null | "incomplete" | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_SOURCE_INTERVAL_SECONDS) {
      return "invalid";
    }
    return parsed;
  }

  if (!/^\d+(?::\d*){1,2}$/.test(trimmed)) return "invalid";
  if (trimmed.endsWith(":")) return "incomplete";
  const segmentsRaw = trimmed.split(":");
  if (segmentsRaw.some((segment) => segment.length === 0)) return "incomplete";

  const segments = segmentsRaw.map((segment) => Number.parseInt(segment, 10));
  if (segments.some((segment) => !Number.isFinite(segment) || segment < 0)) return "invalid";

  let totalSeconds = 0;
  if (segments.length === 2) {
    const [minutes, seconds] = segments;
    if (seconds > 59) return "invalid";
    totalSeconds = minutes * 60 + seconds;
  } else if (segments.length === 3) {
    const [hours, minutes, seconds] = segments;
    if (minutes > 59 || seconds > 59) return "invalid";
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
  } else {
    return "invalid";
  }

  if (totalSeconds > MAX_SOURCE_INTERVAL_SECONDS) return "invalid";
  return totalSeconds;
}

export function formatIntervalInputValue(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || seconds < 0) return "";
  const normalized = Math.floor(seconds);
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainderSeconds = normalized % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(remainderSeconds).padStart(2, "0")}`;
  }
  return String(remainderSeconds);
}

export function formatDurationLabel(seconds: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatIntervalInputValue(seconds);
}

export function isTwitchClipSourceUrl(sourceUrl: string | null | undefined): boolean {
  if (!sourceUrl) return false;
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "clips.twitch.tv") return true;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return (segments[0] === "clip" && !!segments[1]) || (segments[1] === "clip" && !!segments[2]);
  } catch {
    return false;
  }
}
