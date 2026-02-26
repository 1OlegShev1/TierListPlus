"use client";

import { create } from "zustand";

interface SessionItem {
  id: string;
  label: string;
  imageUrl: string;
}

interface TierListState {
  tiers: Record<string, string[]>; // tierKey -> sessionItemId[]
  unranked: string[];
  items: Map<string, SessionItem>;
  activeId: string | null;

  initialize: (
    items: SessionItem[],
    tierKeys: string[]
  ) => void;
  setActiveId: (id: string | null) => void;
  findContainer: (itemId: string) => string | null;
  moveItem: (
    itemId: string,
    toContainer: string,
    toIndex: number
  ) => void;
  reorderInContainer: (
    container: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  getVotes: () => { sessionItemId: string; tierKey: string; rankInTier: number }[];
}

export const useTierListStore = create<TierListState>((set, get) => ({
  tiers: {},
  unranked: [],
  items: new Map(),
  activeId: null,

  initialize: (items, tierKeys) => {
    const itemMap = new Map<string, SessionItem>();
    const ids: string[] = [];
    for (const item of items) {
      itemMap.set(item.id, item);
      ids.push(item.id);
    }
    const tiers: Record<string, string[]> = {};
    for (const key of tierKeys) {
      tiers[key] = [];
    }
    set({ items: itemMap, unranked: ids, tiers });
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
        newTiers[fromContainer] = newTiers[fromContainer].filter(
          (id) => id !== itemId
        );
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

  getVotes: () => {
    const { tiers } = get();
    const votes: { sessionItemId: string; tierKey: string; rankInTier: number }[] = [];
    for (const [tierKey, ids] of Object.entries(tiers)) {
      for (let i = 0; i < ids.length; i++) {
        votes.push({ sessionItemId: ids[i], tierKey, rankInTier: i });
      }
    }
    return votes;
  },
}));
