"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import type { Item } from "@/types";

const sizeConfig = {
  sm: {
    container: "w-full gap-2",
    wrapper: "min-w-0 flex-1 sm:w-44 sm:flex-none",
    card: "gap-2 p-2 sm:gap-2 sm:p-4",
    img: "mx-auto aspect-square w-full max-w-[6.75rem] sm:h-24 sm:w-24 sm:max-w-none",
    vs: "text-base sm:text-xl",
    label:
      "w-full text-center text-[0.78rem] font-medium leading-tight [overflow-wrap:anywhere] sm:text-sm",
  },
  lg: {
    container: "gap-8",
    wrapper: "w-64",
    card: "gap-4 p-6",
    img: "h-48 w-48",
    vs: "text-3xl",
    label: "text-lg font-medium",
  },
};

export function MatchupVoter({
  itemA,
  itemB,
  size = "lg",
  disabled = false,
  onVote,
  onOpenSource,
}: {
  itemA: Item;
  itemB: Item;
  size?: "sm" | "lg";
  disabled?: boolean;
  onVote: (chosenId: string) => void;
  onOpenSource?: (item: Item) => void;
}) {
  const s = sizeConfig[size];
  const [previewingItemId, setPreviewingItemId] = useState<string | null>(null);
  const [supportsHover, setSupportsHover] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    const apply = () => setSupportsHover(media.matches);
    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    legacyMedia.addListener?.(apply);
    return () => legacyMedia.removeListener?.(apply);
  }, []);

  useEffect(() => {
    if (!disabled) return;
    setPreviewingItemId(null);
  }, [disabled]);

  const renderItem = (item: Item) => (
    <div key={item.id} className={`relative ${s.wrapper}`}>
      {item.sourceUrl && onOpenSource && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenSource(item);
          }}
          disabled={disabled}
          className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] text-[var(--source-control-linked-fg)] shadow-sm transition-colors hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default disabled:opacity-70"
          aria-label={`Open source for ${item.label || "item"}`}
          title="Open source details"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onVote(item.id)}
        onPointerEnter={() => {
          if (!supportsHover || disabled) return;
          setPreviewingItemId(item.id);
        }}
        onPointerLeave={() => {
          if (!supportsHover) return;
          setPreviewingItemId((current) => (current === item.id ? null : current));
        }}
        onFocus={() => {
          if (disabled) return;
          setPreviewingItemId(item.id);
        }}
        onBlur={(event) => {
          const nextFocused = event.relatedTarget;
          if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return;
          setPreviewingItemId((current) => (current === item.id ? null : current));
        }}
        disabled={disabled}
        className={`group flex w-full min-w-0 flex-col items-center rounded-2xl border-2 border-[var(--border-default)] bg-[var(--bg-surface)] transition-all hover:border-[var(--accent-primary-hover)] hover:bg-[var(--bg-surface-hover)] disabled:cursor-default disabled:opacity-50 ${s.card} ${
          size === "lg" ? "gap-4" : "gap-2"
        }`}
      >
        <ItemArtwork
          src={item.imageUrl}
          alt={item.label}
          className={`${s.img} rounded-xl`}
          imageClassName="transition-transform group-hover:scale-105"
          presentation="ambient"
          inset={size === "lg" ? "compact" : "tight"}
          animate={previewingItemId === item.id}
          showAnimatedHint
        />
        <span className={`text-center ${s.label}`}>{item.label}</span>
      </button>
    </div>
  );

  return (
    <div className={`flex items-center justify-center ${s.container}`}>
      {renderItem(itemA)}
      <span className={`shrink-0 ${s.vs} font-bold text-[var(--fg-muted)]`}>VS</span>
      {renderItem(itemB)}
    </div>
  );
}
