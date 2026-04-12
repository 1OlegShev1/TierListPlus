"use client";

import { FilePenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { buildListEditorScopeId, LocalListDraftStore } from "@/lib/list-draft-storage";

interface ListDetailDraftIndicatorProps {
  listId: string;
  spaceId: string | null;
}

export function ListDetailDraftIndicator({ listId, spaceId }: ListDetailDraftIndicatorProps) {
  const { userId, isLoading: userLoading } = useUser();
  const [hasDraft, setHasDraft] = useState(false);
  const draftStoreRef = useRef(new LocalListDraftStore());

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setHasDraft(false);
      return;
    }

    let cancelled = false;

    const loadDraft = async () => {
      const scopeId = buildListEditorScopeId({ listId, spaceId });
      const draft = await Promise.resolve(draftStoreRef.current.load({ userId, scopeId }));
      if (cancelled) return;
      setHasDraft(!!draft);
    };

    void loadDraft();
    return () => {
      cancelled = true;
    };
  }, [listId, spaceId, userId, userLoading]);

  if (!hasDraft) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/12 px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--accent-primary-hover)]"
      title="Unsaved draft exists"
      data-testid="list-draft-indicator"
    >
      <FilePenLine className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Draft</span>
    </span>
  );
}
