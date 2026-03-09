"use client";

import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ConsensusItem } from "@/lib/consensus";

const DETAILS_PANEL_ANIMATION_MS = 240;

interface UseResultsDetailsPanelArgs {
  participantId: string | null;
  initialParticipantError: string | null;
}

export function useResultsDetailsPanel({
  participantId,
  initialParticipantError,
}: UseResultsDetailsPanelArgs) {
  const [selectedItem, setSelectedItem] = useState<ConsensusItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<ConsensusItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isTouchInput, setIsTouchInput] = useState(false);

  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const wasDetailsOpenRef = useRef(false);
  const touchStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const previousParticipantIdRef = useRef<string | null>(participantId);
  const isIndividualView = !!participantId;

  useEffect(() => {
    const media = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => {
      const hasTouch = navigator.maxTouchPoints > 0;
      setIsTouchInput(media.matches || hasTouch);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const justOpened = detailsOpen && !wasDetailsOpenRef.current;
    wasDetailsOpenRef.current = detailsOpen;

    if (!justOpened || !detailsItem || isIndividualView || initialParticipantError) {
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const panel = detailsPanelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const topOffset = isTouchInput ? 68 : 88;
        const bottomBuffer = isTouchInput ? 20 : 28;

        const needsScroll =
          rect.top < topOffset ||
          rect.top > viewportHeight - 120 ||
          rect.bottom > viewportHeight - bottomBuffer;

        if (!needsScroll) return;
        panel.scrollIntoView({
          behavior: isTouchInput ? "auto" : "smooth",
          block: "start",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [detailsItem, detailsOpen, initialParticipantError, isIndividualView, isTouchInput]);

  useEffect(() => {
    if (previousParticipantIdRef.current === participantId) return;
    previousParticipantIdRef.current = participantId;
    setSelectedItem(null);
  }, [participantId]);

  useEffect(() => {
    if (isIndividualView) {
      setDetailsOpen(false);
      setDetailsItem(null);
      return;
    }

    if (selectedItem) {
      setDetailsItem(selectedItem);
      const raf = window.requestAnimationFrame(() => {
        setDetailsOpen(true);
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setDetailsOpen(false);
    const timeout = window.setTimeout(() => {
      setDetailsItem(null);
    }, DETAILS_PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isIndividualView, selectedItem]);

  useEffect(() => {
    if (!isIndividualView || !selectedItem) return;

    const collapseSelected = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-peek-item="true"]')) return;
      setSelectedItem(null);
    };

    document.addEventListener("pointerdown", collapseSelected, true);
    return () => document.removeEventListener("pointerdown", collapseSelected, true);
  }, [isIndividualView, selectedItem]);

  const handleItemSelect = useCallback((item: ConsensusItem) => {
    setSelectedItem((current) => (current?.id === item.id ? null : item));
  }, []);

  const handleItemToggle = useCallback(
    (item: ConsensusItem) => {
      handleItemSelect(item);
    },
    [handleItemSelect],
  );

  const handleItemClick = useCallback(
    (item: ConsensusItem) => {
      if (isTouchInput) return;
      handleItemSelect(item);
    },
    [handleItemSelect, isTouchInput],
  );

  const handleItemTouchStart = useCallback(
    (itemId: string, event: TouchEvent<HTMLButtonElement>) => {
      if (!isTouchInput) return;
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { id: itemId, x: touch.clientX, y: touch.clientY };
    },
    [isTouchInput],
  );

  const handleItemTouchEnd = useCallback(
    (item: ConsensusItem, event: TouchEvent<HTMLButtonElement>) => {
      if (!isTouchInput) return;
      const touch = event.changedTouches[0];
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!touch || !start || start.id !== item.id) return;
      const movedX = Math.abs(touch.clientX - start.x);
      const movedY = Math.abs(touch.clientY - start.y);
      if (movedX > 8 || movedY > 8) return;
      event.preventDefault();
      handleItemSelect(item);
    },
    [handleItemSelect, isTouchInput],
  );

  const handleItemTouchCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  return {
    selectedItem,
    detailsItem,
    detailsOpen,
    detailsPanelRef,
    isTouchInput,
    handleItemToggle,
    handleItemClick,
    handleItemTouchStart,
    handleItemTouchEnd,
    handleItemTouchCancel,
  };
}
