import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  areListEditorDraftsEquivalent,
  buildListEditorScopeId,
  createListEditorDraftSnapshot,
  type ListDraftContext,
  type ListEditorDraftSnapshot,
  LocalListDraftStore,
} from "@/lib/list-draft-storage";
import type { TemplateItemData } from "@/types";

interface UseListEditorDraftsParams {
  userId: string | null | undefined;
  userLoading: boolean;
  listId?: string;
  spaceId?: string | null;
  initialName: string;
  initialDescription: string;
  initialIsPublic: boolean;
  initialItems: TemplateItemData[];
  name: string;
  description: string;
  isPublic: boolean;
  items: TemplateItemData[];
  onApplySnapshot: (snapshot: ListEditorDraftSnapshot) => void;
}

interface UseListEditorDraftsResult {
  isDirty: boolean;
  draftNotice: string | null;
  clearStoredDraft: () => Promise<void>;
  discardDraftAndReset: () => Promise<void>;
}

export function useListEditorDrafts({
  userId,
  userLoading,
  listId,
  spaceId,
  initialName,
  initialDescription,
  initialIsPublic,
  initialItems,
  name,
  description,
  isPublic,
  items,
  onApplySnapshot,
}: UseListEditorDraftsParams): UseListEditorDraftsResult {
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const draftStoreRef = useRef(new LocalListDraftStore());
  const loadedScopeKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const baselineSnapshot = useMemo(
    () =>
      createListEditorDraftSnapshot({
        updatedAtMs: 1,
        name: initialName,
        description: initialDescription,
        isPublic: initialIsPublic,
        items: initialItems,
      }),
    [initialName, initialDescription, initialIsPublic, initialItems],
  );

  const currentSnapshot = useMemo(
    () =>
      createListEditorDraftSnapshot({
        updatedAtMs: 1,
        name,
        description,
        isPublic,
        items,
      }),
    [name, description, isPublic, items],
  );

  const isDirty = !areListEditorDraftsEquivalent(currentSnapshot, baselineSnapshot);
  const draftContext = useMemo<ListDraftContext | null>(() => {
    if (!userId) return null;
    return {
      userId,
      scopeId: buildListEditorScopeId({ listId, spaceId }),
    };
  }, [userId, listId, spaceId]);

  const resetToBaseline = useCallback(() => {
    onApplySnapshot(baselineSnapshot);
    setDraftNotice(null);
  }, [baselineSnapshot, onApplySnapshot]);

  const clearStoredDraft = useCallback(async () => {
    if (!draftContext) return;
    try {
      await Promise.resolve(draftStoreRef.current.clear(draftContext));
    } catch {
      // Best effort only.
    }
  }, [draftContext]);

  const discardDraftAndReset = useCallback(async () => {
    await clearStoredDraft();
    resetToBaseline();
  }, [clearStoredDraft, resetToBaseline]);

  useEffect(() => {
    if (!draftContext) {
      loadedScopeKeyRef.current = null;
      setDraftHydrated(false);
      return;
    }
    const scopeKey = `${draftContext.userId}:${draftContext.scopeId}`;
    if (loadedScopeKeyRef.current !== scopeKey) {
      setDraftHydrated(false);
    }
    if (loadedScopeKeyRef.current === scopeKey) return;
    if (userLoading) return;

    loadedScopeKeyRef.current = scopeKey;
    let cancelled = false;

    const loadDraft = async () => {
      try {
        const draft = await Promise.resolve(draftStoreRef.current.load(draftContext));
        if (cancelled) return;
        if (!draft) return;

        if (areListEditorDraftsEquivalent(draft, baselineSnapshot)) {
          await clearStoredDraft();
          return;
        }

        onApplySnapshot(draft);
        setDraftNotice("Draft restored.");
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
  }, [draftContext, userLoading, baselineSnapshot, clearStoredDraft, onApplySnapshot]);

  useEffect(() => {
    if (!draftContext || !draftHydrated) return;

    const timeout = setTimeout(() => {
      if (!isDirty) {
        void clearStoredDraft();
        return;
      }

      const snapshot = createListEditorDraftSnapshot({
        name,
        description,
        isPublic,
        items,
      });
      void Promise.resolve(draftStoreRef.current.save(draftContext, snapshot));
    }, 300);

    return () => clearTimeout(timeout);
  }, [draftContext, draftHydrated, isDirty, name, description, isPublic, items, clearStoredDraft]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    if (isDirty) {
      window.addEventListener("beforeunload", handler);
    }

    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return {
    isDirty,
    draftNotice,
    clearStoredDraft,
    discardDraftAndReset,
  };
}
