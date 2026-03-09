export type SourceArtworkPlaceholderKind = "GENERIC" | "VIDEO" | "AUDIO" | "DOCUMENT";

const SOURCE_ARTWORK_PLACEHOLDER_PREFIX = "source-placeholder://";

const SOURCE_ARTWORK_PLACEHOLDER_MAP: Record<SourceArtworkPlaceholderKind, string> = {
  GENERIC: `${SOURCE_ARTWORK_PLACEHOLDER_PREFIX}generic`,
  VIDEO: `${SOURCE_ARTWORK_PLACEHOLDER_PREFIX}video`,
  AUDIO: `${SOURCE_ARTWORK_PLACEHOLDER_PREFIX}audio`,
  DOCUMENT: `${SOURCE_ARTWORK_PLACEHOLDER_PREFIX}document`,
};

export function getSourceArtworkPlaceholderImageUrl(kind: SourceArtworkPlaceholderKind): string {
  return SOURCE_ARTWORK_PLACEHOLDER_MAP[kind];
}

export function parseSourceArtworkPlaceholderImageUrl(
  imageUrl: string | null | undefined,
): SourceArtworkPlaceholderKind | null {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith(SOURCE_ARTWORK_PLACEHOLDER_PREFIX)) return null;

  const rawKind = imageUrl.slice(SOURCE_ARTWORK_PLACEHOLDER_PREFIX.length).toUpperCase();
  if (rawKind === "VIDEO") return "VIDEO";
  if (rawKind === "AUDIO") return "AUDIO";
  if (rawKind === "DOCUMENT") return "DOCUMENT";
  if (rawKind === "GENERIC") return "GENERIC";
  return null;
}
