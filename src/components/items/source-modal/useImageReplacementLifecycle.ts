"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageUploaderHandle, UploadedImage } from "@/components/shared/ImageUploader";
import { tryCleanupUnattachedUpload } from "@/lib/api-client";
import { extractManagedUploadFilename } from "@/lib/uploads";

const FILE_PICKER_CANCEL_GUARD_MS = 500;

interface UseImageReplacementLifecycleArgs {
  draftReplacementImageUrl: string | null;
  setDraftReplacementImageUrl: (url: string | null) => void;
}

export function useImageReplacementLifecycle({
  draftReplacementImageUrl,
  setDraftReplacementImageUrl,
}: UseImageReplacementLifecycleArgs) {
  const cardImageUploaderRef = useRef<ImageUploaderHandle>(null);
  const isSelectingImageRef = useRef(false);
  const imagePickerCancelGuardUntilRef = useRef(0);
  const imagePickerSafetyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUploadedImageUrlsRef = useRef<Set<string>>(new Set());
  const [isUploadingCustomImage, setIsUploadingCustomImage] = useState(false);

  const cleanupPendingUploadedImage = useCallback((imageUrl: string, context: string) => {
    if (!extractManagedUploadFilename(imageUrl)) return;
    void tryCleanupUnattachedUpload(imageUrl, context);
  }, []);

  const cleanupPendingUploadedImages = useCallback(
    (context: string) => {
      const pendingUrls = [...pendingUploadedImageUrlsRef.current];
      pendingUploadedImageUrlsRef.current.clear();
      for (const imageUrl of pendingUrls) {
        cleanupPendingUploadedImage(imageUrl, context);
      }
    },
    [cleanupPendingUploadedImage],
  );

  useEffect(() => {
    return () => {
      if (imagePickerSafetyResetTimeoutRef.current) {
        clearTimeout(imagePickerSafetyResetTimeoutRef.current);
      }
      cleanupPendingUploadedImages("item source modal unmount");
    };
  }, [cleanupPendingUploadedImages]);

  const releasePendingUploadedImage = useCallback(
    (imageUrl: string | null, context: string) => {
      if (!imageUrl) return;
      if (!pendingUploadedImageUrlsRef.current.delete(imageUrl)) return;
      cleanupPendingUploadedImage(imageUrl, context);
    },
    [cleanupPendingUploadedImage],
  );

  const handleCustomImageUploaded = useCallback(
    ({ url }: UploadedImage) => {
      isSelectingImageRef.current = false;
      imagePickerCancelGuardUntilRef.current = 0;
      if (imagePickerSafetyResetTimeoutRef.current) {
        clearTimeout(imagePickerSafetyResetTimeoutRef.current);
        imagePickerSafetyResetTimeoutRef.current = null;
      }
      if (draftReplacementImageUrl && draftReplacementImageUrl !== url) {
        releasePendingUploadedImage(draftReplacementImageUrl, "item source custom image replaced");
      }
      pendingUploadedImageUrlsRef.current.add(url);
      setDraftReplacementImageUrl(url);
    },
    [draftReplacementImageUrl, releasePendingUploadedImage, setDraftReplacementImageUrl],
  );

  const resetImagePickerGuard = useCallback(() => {
    isSelectingImageRef.current = false;
    imagePickerCancelGuardUntilRef.current = 0;
    if (imagePickerSafetyResetTimeoutRef.current) {
      clearTimeout(imagePickerSafetyResetTimeoutRef.current);
      imagePickerSafetyResetTimeoutRef.current = null;
    }
  }, []);

  const openImageFilePicker = useCallback(
    (disabled: boolean) => {
      if (disabled || isUploadingCustomImage) return;
      isSelectingImageRef.current = true;
      imagePickerCancelGuardUntilRef.current = Date.now() + FILE_PICKER_CANCEL_GUARD_MS;
      if (typeof window !== "undefined") {
        const handleWindowFocus = () => {
          imagePickerCancelGuardUntilRef.current = Date.now() + FILE_PICKER_CANCEL_GUARD_MS;
          setTimeout(() => {
            isSelectingImageRef.current = false;
          }, FILE_PICKER_CANCEL_GUARD_MS);
        };
        window.addEventListener("focus", handleWindowFocus, { once: true, capture: true });
      }
      if (imagePickerSafetyResetTimeoutRef.current) {
        clearTimeout(imagePickerSafetyResetTimeoutRef.current);
      }
      imagePickerSafetyResetTimeoutRef.current = setTimeout(() => {
        resetImagePickerGuard();
      }, 15_000);
      cardImageUploaderRef.current?.openFilePicker();
    },
    [isUploadingCustomImage, resetImagePickerGuard],
  );

  const isWithinImagePickerCancelGuard = useCallback(
    () => isSelectingImageRef.current || Date.now() < imagePickerCancelGuardUntilRef.current,
    [],
  );

  const markSavedImageAsAttached = useCallback((imageUrl: string | null | undefined) => {
    if (!imageUrl) return;
    pendingUploadedImageUrlsRef.current.delete(imageUrl);
  }, []);

  return {
    cardImageUploaderRef,
    isUploadingCustomImage,
    setIsUploadingCustomImage,
    handleCustomImageUploaded,
    openImageFilePicker,
    isWithinImagePickerCancelGuard,
    cleanupPendingUploadedImages,
    releasePendingUploadedImage,
    markSavedImageAsAttached,
    resetImagePickerGuard,
  };
}
