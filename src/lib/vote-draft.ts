const KEY_PREFIX = "tierlistplus_draft_";

export interface DraftState {
  tiers: Record<string, string[]>;
  unranked: string[];
}

function storageKey(sessionId: string, participantId: string) {
  return `${KEY_PREFIX}${sessionId}_${participantId}`;
}

/** Load a saved draft from localStorage. Returns null if none exists or data is invalid. */
export function getDraft(
  sessionId: string,
  participantId: string,
  validItemIds: Set<string>,
): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(sessionId, participantId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed.tiers || !parsed.unranked) return null;

    // Filter out item IDs that no longer exist in the session
    const filtered: DraftState = {
      unranked: parsed.unranked.filter((id) => validItemIds.has(id)),
      tiers: Object.fromEntries(
        Object.entries(parsed.tiers).map(([key, ids]) => [
          key,
          ids.filter((id) => validItemIds.has(id)),
        ]),
      ),
    };

    // Only restore if the draft still has at least one item placed in a tier
    const hasRankedItems = Object.values(filtered.tiers).some((ids) => ids.length > 0);
    if (!hasRankedItems) return null;

    return filtered;
  } catch {
    return null;
  }
}

/** Persist current tier/unranked state as a draft. */
export function saveDraft(sessionId: string, participantId: string, state: DraftState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(sessionId, participantId), JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Remove the draft after a successful submit. */
export function clearDraft(sessionId: string, participantId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(sessionId, participantId));
  } catch {
    // ignore
  }
}
