"use client";

import { useCallback } from "react";
import { getLocalUserId } from "@/lib/device-identity";

const STORAGE_KEY = "tierlistplus_participants";

interface StoredParticipant {
  participantId: string;
  nickname: string;
}

type ParticipantStorage = Record<string, Record<string, StoredParticipant>>;

function isStoredParticipant(value: unknown): value is StoredParticipant {
  return (
    typeof value === "object" &&
    value !== null &&
    "participantId" in value &&
    "nickname" in value &&
    typeof value.participantId === "string" &&
    typeof value.nickname === "string"
  );
}

function getParticipants(): ParticipantStorage {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as
      | ParticipantStorage
      | Record<string, StoredParticipant>;

    if (Object.values(parsed).some((value) => isStoredParticipant(value))) {
      const userId = getLocalUserId();
      if (!userId) {
        return {};
      }

      const migrated = {
        [userId]: parsed as Record<string, StoredParticipant>,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return parsed as ParticipantStorage;
  } catch {
    return {};
  }
}

function getCurrentUserParticipants() {
  const userId = getLocalUserId();
  if (!userId) return {};

  const all = getParticipants();
  return all[userId] ?? {};
}

/** Save participant data for a session (can be called outside of hooks) */
export function saveParticipant(sessionId: string, participantId: string, nickname: string) {
  const userId = getLocalUserId();
  if (!userId) return;

  const all = getParticipants();
  all[userId] = all[userId] ?? {};
  all[userId][sessionId] = { participantId, nickname };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearAllParticipants() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function useParticipant(sessionId: string) {
  const data = getCurrentUserParticipants()[sessionId];

  const save = useCallback(
    (participantId: string, nickname: string) => {
      const userId = getLocalUserId();
      if (!userId) return;

      const all = getParticipants();
      all[userId] = all[userId] ?? {};
      all[userId][sessionId] = { participantId, nickname };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    },
    [sessionId],
  );

  const clear = useCallback(() => {
    const userId = getLocalUserId();
    if (!userId) return;

    const all = getParticipants();
    if (all[userId]) {
      delete all[userId][sessionId];
      if (Object.keys(all[userId]).length === 0) {
        delete all[userId];
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }, [sessionId]);

  return {
    participantId: data?.participantId ?? null,
    nickname: data?.nickname ?? null,
    save,
    clear,
  };
}
