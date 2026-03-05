"use client";

import { useEffect, useState } from "react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import type { Item } from "@/types";

const sizeConfig = {
  sm: {
    container: "w-full gap-3",
    card: "min-w-0 flex-1 gap-2.5 p-2.5 sm:w-44 sm:flex-none sm:gap-2 sm:p-4",
    img: "mx-auto aspect-square w-full max-w-[8.25rem] sm:h-24 sm:w-24 sm:max-w-none",
    vs: "text-lg sm:text-xl",
    label: "w-full text-sm font-medium leading-tight",
  },
  lg: {
    container: "gap-8",
    card: "w-64 gap-4 p-6",
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
}: {
  itemA: Item;
  itemB: Item;
  size?: "sm" | "lg";
  disabled?: boolean;
  onVote: (chosenId: string) => void;
}) {
  const s = sizeConfig[size];
  const [previewingItemId, setPreviewingItemId] = useState<string | null>(null);
  const [supportsHover, setSupportsHover] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setSupportsHover(media.matches);
    apply();

    if ("addEventListener" in media) {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  useEffect(() => {
    if (!disabled) return;
    setPreviewingItemId(null);
  }, [disabled]);

  const renderItem = (item: Item) => (
    <button
      key={item.id}
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
      className={`group flex ${s.card} flex-col items-center rounded-2xl border-2 border-neutral-700 bg-neutral-900 transition-all hover:border-amber-400 hover:bg-neutral-800 disabled:opacity-50`}
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
  );

  return (
    <div className={`flex items-center justify-center ${s.container}`}>
      {renderItem(itemA)}
      <span className={`shrink-0 ${s.vs} font-bold text-neutral-600`}>VS</span>
      {renderItem(itemB)}
    </div>
  );
}
