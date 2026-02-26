"use client";

import { create } from "zustand";
import type { Item, VotePayload } from "@/types";

interface TierListState {
  tiers: Record<string, string[]>; // tierKey -> sessionItemId[]
  unranked: string[];
  items: Map<string, Item>;
  activeId: string | null;

  initialize: (items: Item[], tierKeys: string[], seededTiers?: Record<string, string[]>) => void;
  setActiveId: (id: string | null) => void;
  findContainer: (itemId: string) => string | null;
  moveItem: (itemId: string, toContainer: string, toIndex: number) => void;
  reorderInContainer: (container: string, fromIndex: number, toIndex: number) => void;
  reorderTier: (tierKey: string, orderedIds: string[]) => void;
  getVotes: () => VotePayload[];
}

export const useTierListStore = create<TierListState>((set, get) => ({
  tiers: {},
  unranked: [],
  items: new Map(),
  activeId: null,

  initialize: (items, tierKeys, seededTiers) => {
    const itemMap = new Map<string, Item>();
    for (const item of items) {
      itemMap.set(item.id, item);
    }

    const tiers: Record<string, string[]> = {};
    const seededIds = new Set<string>();

    for (const key of tierKeys) {
      if (seededTiers?.[key]) {
        // Only include IDs that actually exist in items
        const valid = seededTiers[key].filter((id) => itemMap.has(id));
        tiers[key] = valid;
        for (const id of valid) seededIds.add(id);
      } else {
        tiers[key] = [];
      }
    }

    // Anything not seeded goes to unranked
    const unranked = items.filter((i) => !seededIds.has(i.id)).map((i) => i.id);

    set({ items: itemMap, unranked, tiers });
  },

  setActiveId: (id) => set({ activeId: id }),

  findContainer: (itemId) => {
    const { tiers, unranked } = get();
    if (unranked.includes(itemId)) return "unranked";
    for (const [key, ids] of Object.entries(tiers)) {
      if (ids.includes(itemId)) return key;
    }
    return null;
  },

  moveItem: (itemId, toContainer, toIndex) => {
    set((state) => {
      const fromContainer = state.findContainer(itemId);
      if (!fromContainer || fromContainer === toContainer) return state;

      // Remove from source
      const newTiers = { ...state.tiers };
      let newUnranked = [...state.unranked];

      if (fromContainer === "unranked") {
        newUnranked = newUnranked.filter((id) => id !== itemId);
      } else {
        newTiers[fromContainer] = newTiers[fromContainer].filter((id) => id !== itemId);
      }

      // Add to destination
      if (toContainer === "unranked") {
        newUnranked.splice(toIndex, 0, itemId);
      } else {
        const dest = [...(newTiers[toContainer] || [])];
        dest.splice(toIndex, 0, itemId);
        newTiers[toContainer] = dest;
      }

      return { tiers: newTiers, unranked: newUnranked };
    });
  },

  reorderInContainer: (container, fromIndex, toIndex) => {
    set((state) => {
      if (container === "unranked") {
        const arr = [...state.unranked];
        const [item] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, item);
        return { unranked: arr };
      }
      const newTiers = { ...state.tiers };
      const arr = [...newTiers[container]];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      newTiers[container] = arr;
      return { tiers: newTiers };
    });
  },

  reorderTier: (tierKey, orderedIds) => {
    set((state) => {
      const newTiers = { ...state.tiers };
      newTiers[tierKey] = orderedIds;
      return { tiers: newTiers };
    });
  },

  getVotes: () => {
    const { tiers } = get();
    const votes: VotePayload[] = [];
    for (const [tierKey, ids] of Object.entries(tiers)) {
      for (let i = 0; i < ids.length; i++) {
        votes.push({ sessionItemId: ids[i], tierKey, rankInTier: i });
      }
    }
    return votes;
  },
}));
