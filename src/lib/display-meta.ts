export function splitUpdatedMeta(meta: string) {
  const marker = " · Updated ";
  const markerIndex = meta.lastIndexOf(marker);

  if (markerIndex === -1) {
    return {
      details: meta,
      updated: null,
    };
  }

  return {
    details: meta.slice(0, markerIndex),
    updated: meta.slice(markerIndex + 3),
  };
}
