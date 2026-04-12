import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  areVoteBoardDraftsEquivalent,
  buildVoteBoardScopeId,
  createVoteBoardDraftSnapshot,
  LocalVoteDraftStore,
  type VoteBoardDraftSnapshot,
  type VoteDraftContext,
  type VoteDraftStore,
} from "@/lib/vote-draft-storage";

interface UseVoteBoardDraftsParams {
  userId: string | null | undefined;
  userLoading: boolean;
  sessionId: string;
  participantId: string;
  tierKeys: string[];
  validItemIds: Set<string>;
  enabled: boolean;
  baselineSnapshot: VoteBoardDraftSnapshot;
  currentSnapshot: VoteBoardDraftSnapshot;
  warnOnUnloadWhenDirty: boolean;
  onApplySnapshot: (snapshot: VoteBoardDraftSnapshot) => void;
  onDraftRestored?: () => void;
}

interface UseVoteBoardDraftsResult {
  isDirty: boolean;
  clearStoredDraft: () => Promise<void>;
}

export function useVoteBoardDrafts({
  userId,
  userLoading,
  sessionId,
  participantId,
  tierKeys,
  validItemIds,
  enabled,
  baselineSnapshot,
  currentSnapshot,
  warnOnUnloadWhenDirty,
  onApplySnapshot,
  onDraftRestored,
}: UseVoteBoardDraftsParams): UseVoteBoardDraftsResult {
  const draftStoreRef = useRef<VoteDraftStore>(new LocalVoteDraftStore());
  const loadedScopeKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const isDirty = useMemo(
    () => !areVoteBoardDraftsEquivalent(currentSnapshot, baselineSnapshot, tierKeys),
    [currentSnapshot, baselineSnapshot, tierKeys],
  );

  const draftContext = useMemo<VoteDraftContext | null>(() => {
    if (!userId) return null;
    return {
      userId,
      scopeId: buildVoteBoardScopeId({ sessionId, participantId }),
      tierKeys,
      validItemIds,
    };
  }, [userId, sessionId, participantId, tierKeys, validItemIds]);

  const clearStoredDraft = useCallback(async () => {
    if (!draftContext) return;
    try {
      await Promise.resolve(draftStoreRef.current.clear(draftContext));
    } catch {
      // Best effort only.
    }
  }, [draftContext]);

  useEffect(() => {
    if (!enabled) {
      loadedScopeKeyRef.current = null;
      setDraftHydrated(false);
      return;
    }

    if (!draftContext) {
      loadedScopeKeyRef.current = null;
      setDraftHydrated(!userLoading);
      return;
    }

    if (userLoading) return;

    const scopeKey = `${draftContext.userId}:${draftContext.scopeId}`;
    const isSameScope = loadedScopeKeyRef.current === scopeKey;
    if (!isSameScope) {
      loadedScopeKeyRef.current = scopeKey;
      setDraftHydrated(false);
    }
    if (isSameScope && draftHydrated) return;
    let cancelled = false;

    const loadDraft = async () => {
      try {
        const draft = await Promise.resolve(draftStoreRef.current.load(draftContext));
        if (cancelled || !draft) return;

        if (areVoteBoardDraftsEquivalent(draft, baselineSnapshot, tierKeys)) {
          await clearStoredDraft();
          return;
        }

        onApplySnapshot(draft);
        onDraftRestored?.();
      } finally {
        if (!cancelled) {
          setDraftHydrated(true);
        }
      }
    };

    void loadDraft();
    return () => {
      cancelled = true;
    };
  }, [
    baselineSnapshot,
    clearStoredDraft,
    draftContext,
    onApplySnapshot,
    onDraftRestored,
    tierKeys,
    enabled,
    userLoading,
    draftHydrated,
  ]);

  useEffect(() => {
    if (!enabled || !draftContext || !draftHydrated) return;

    const timeout = setTimeout(() => {
      if (!isDirty) {
        void clearStoredDraft();
        return;
      }

      const snapshot = createVoteBoardDraftSnapshot({
        tierKeys,
        validItemIds,
        tiers: currentSnapshot.tiers,
        unranked: currentSnapshot.unranked,
      });
      void Promise.resolve(draftStoreRef.current.save(draftContext, snapshot));
    }, 300);

    return () => clearTimeout(timeout);
  }, [
    clearStoredDraft,
    currentSnapshot.tiers,
    currentSnapshot.unranked,
    draftContext,
    draftHydrated,
    isDirty,
    tierKeys,
    validItemIds,
    enabled,
  ]);

  useEffect(() => {
    if (!enabled || !warnOnUnloadWhenDirty || !isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled, isDirty, warnOnUnloadWhenDirty]);

  return {
    isDirty,
    clearStoredDraft,
  };
}
