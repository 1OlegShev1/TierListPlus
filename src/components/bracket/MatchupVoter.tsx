"use client";

import type { Item } from "@/types";

const sizeConfig = {
  sm: {
    container: "gap-4",
    card: "w-44 gap-2 p-4",
    img: "h-24 w-24",
    vs: "text-xl",
    label: "text-sm font-medium",
  },
  lg: {
    container: "gap-6",
    card: "w-52 gap-3 p-6",
    img: "h-32 w-32",
    vs: "text-2xl",
    label: "font-medium",
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

  const renderItem = (item: Item) => (
    <button
      key={item.id}
      onClick={() => onVote(item.id)}
      disabled={disabled}
      className={`group flex ${s.card} flex-col items-center rounded-2xl border-2 border-neutral-700 bg-neutral-900 transition-all hover:border-amber-400 hover:bg-neutral-800 disabled:opacity-50`}
    >
      <img
        src={item.imageUrl}
        alt={item.label}
        className={`${s.img} rounded-xl object-cover transition-transform group-hover:scale-105`}
      />
      <span className={`text-center ${s.label}`}>{item.label}</span>
    </button>
  );

  return (
    <div className={`flex items-center justify-center ${s.container}`}>
      {renderItem(itemA)}
      <span className={`${s.vs} font-bold text-neutral-600`}>VS</span>
      {renderItem(itemB)}
    </div>
  );
}
