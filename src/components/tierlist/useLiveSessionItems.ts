"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadedImage } from "@/components/shared/ImageUploader";
import {
  apiDelete,
  apiPatch,
  apiPost,
  getErrorMessage,
  tryCleanupUnattachedUpload,
} from "@/lib/api-client";
import type { Item } from "@/types";

interface UseLiveSessionItemsArgs {
  sessionId: string;
  canManageItems: boolean;
  submitting: boolean;
  submitted: boolean;
  appendItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
}

export function useLiveSessionItems({
  sessionId,
  canManageItems,
  submitting,
  submitted,
  appendItem,
  updateItem,
  removeItem,
}: UseLiveSessionItemsArgs) {
  const [creatingItemCount, setCreatingItemCount] = useState(0);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [itemMutationError, setItemMutationError] = useState<string | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const createItemQueueRef = useRef<Promise<void>>(Promise.resolve());
  const uploadingFilesRef = useRef(false);
  const mountedRef = useRef(true);
  const latestSessionIdRef = useRef(sessionId);

  useEffect(() => {
    latestSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCurrentSession = useCallback((requestSessionId: string) => {
    return mountedRef.current && latestSessionIdRef.current === requestSessionId;
  }, []);

  const canCreateLiveItems = useCallback(
    (requestSessionId: string) => {
      return canManageItems && !submitting && !submitted && isCurrentSession(requestSessionId);
    },
    [canManageItems, isCurrentSession, submitted, submitting],
  );

  const canMutateLiveItems = useCallback(
    (requestSessionId: string) => {
      return (
        canManageItems &&
        !savingItemId &&
        !removingItemId &&
        !submitting &&
        !submitted &&
        isCurrentSession(requestSessionId)
      );
    },
    [canManageItems, isCurrentSession, removingItemId, savingItemId, submitted, submitting],
  );

  const hasActiveUpload = useCallback(() => {
    return uploadingFilesRef.current || isUploadingFiles;
  }, [isUploadingFiles]);

  const handleUploadStateChange = useCallback(
    (uploading: boolean) => {
      if (!isCurrentSession(sessionId)) return;
      uploadingFilesRef.current = uploading;
      setIsUploadingFiles(uploading);
    },
    [isCurrentSession, sessionId],
  );

  const cleanupAbandonedUpload = useCallback(async (imageUrl: string) => {
    await tryCleanupUnattachedUpload(imageUrl, "tierlist item flow");
  }, []);

  const handleUploadedImage = useCallback(
    ({ url, suggestedLabel }: UploadedImage) => {
      const requestSessionId = sessionId;
      if (!canCreateLiveItems(requestSessionId)) {
        void cleanupAbandonedUpload(url);
        return;
      }

      setCreatingItemCount((count) => count + 1);
      setItemMutationError(null);

      const createItem = async () => {
        try {
          const item = await apiPost<Item>(`/api/sessions/${sessionId}/items`, {
            label: suggestedLabel.trim(),
            imageUrl: url,
          });
          if (!isCurrentSession(requestSessionId)) {
            void cleanupAbandonedUpload(url);
            return;
          }
          appendItem(item);
        } catch (err) {
          void cleanupAbandonedUpload(url);
          if (!isCurrentSession(requestSessionId)) return;
          setItemMutationError(getErrorMessage(err, "Failed to add item"));
        } finally {
          if (isCurrentSession(requestSessionId)) {
            setCreatingItemCount((count) => Math.max(0, count - 1));
          }
        }
      };

      createItemQueueRef.current = createItemQueueRef.current
        .catch(() => undefined)
        .then(createItem);
    },
    [appendItem, canCreateLiveItems, cleanupAbandonedUpload, isCurrentSession, sessionId],
  );

  const handleSaveLiveItemLabel = useCallback(
    async (itemId: string, label: string) => {
      const requestSessionId = sessionId;
      if (!canMutateLiveItems(requestSessionId)) return false;

      setSavingItemId(itemId);
      setItemMutationError(null);
      try {
        const item = await apiPatch<Item>(`/api/sessions/${sessionId}/items/${itemId}`, { label });
        if (!isCurrentSession(requestSessionId)) return false;
        updateItem(item);
        return true;
      } catch (err) {
        if (!isCurrentSession(requestSessionId)) return false;
        setItemMutationError(getErrorMessage(err, "Failed to update item"));
        return false;
      } finally {
        if (isCurrentSession(requestSessionId)) {
          setSavingItemId(null);
        }
      }
    },
    [canMutateLiveItems, isCurrentSession, sessionId, updateItem],
  );

  const handleSaveLiveItemSource = useCallback(
    async (
      itemId: string,
      sourceUrl: string | null,
      sourceNote: string | null,
      sourceStartSec: number | null,
      sourceEndSec: number | null,
    ) => {
      const requestSessionId = sessionId;
      if (!canMutateLiveItems(requestSessionId)) return false;

      setSavingItemId(itemId);
      setItemMutationError(null);
      try {
        const item = await apiPatch<Item>(`/api/sessions/${sessionId}/items/${itemId}`, {
          sourceUrl,
          sourceNote,
          sourceStartSec,
          sourceEndSec,
        });
        if (!isCurrentSession(requestSessionId)) return false;
        updateItem(item);
        return true;
      } catch (err) {
        if (!isCurrentSession(requestSessionId)) return false;
        setItemMutationError(getErrorMessage(err, "Failed to update item source"));
        return false;
      } finally {
        if (isCurrentSession(requestSessionId)) {
          setSavingItemId(null);
        }
      }
    },
    [canMutateLiveItems, isCurrentSession, sessionId, updateItem],
  );

  const handleRemoveLiveItem = useCallback(
    async (itemId: string) => {
      const requestSessionId = sessionId;
      if (!canMutateLiveItems(requestSessionId)) return;

      setRemovingItemId(itemId);
      setItemMutationError(null);
      try {
        await apiDelete(`/api/sessions/${sessionId}/items/${itemId}`);
        if (!isCurrentSession(requestSessionId)) return;
        removeItem(itemId);
      } catch (err) {
        if (!isCurrentSession(requestSessionId)) return;
        setItemMutationError(getErrorMessage(err, "Failed to remove item"));
      } finally {
        if (isCurrentSession(requestSessionId)) {
          setRemovingItemId(null);
        }
      }
    },
    [canMutateLiveItems, isCurrentSession, removeItem, sessionId],
  );

  const hasPendingItemMutations =
    isUploadingFiles || creatingItemCount > 0 || !!savingItemId || !!removingItemId;

  return {
    creatingItemCount,
    savingItemId,
    removingItemId,
    itemMutationError,
    setItemMutationError,
    hasActiveUpload,
    hasPendingItemMutations,
    handleUploadStateChange,
    handleUploadedImage,
    handleSaveLiveItemLabel,
    handleSaveLiveItemSource,
    handleRemoveLiveItem,
  };
}
