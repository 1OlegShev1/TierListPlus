"use client";

import { useCallback } from "react";

const STORAGE_KEY = "tierlistplus_participants";

function getParticipants(): Record<string, { participantId: string; nickname: string }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Save participant data for a session (can be called outside of hooks) */
export function saveParticipant(sessionId: string, participantId: string, nickname: string) {
  const all = getParticipants();
  all[sessionId] = { participantId, nickname };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function useParticipant(sessionId: string) {
  const data = getParticipants()[sessionId];

  const save = useCallback(
    (participantId: string, nickname: string) => {
      const all = getParticipants();
      all[sessionId] = { participantId, nickname };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    },
    [sessionId],
  );

  const clear = useCallback(() => {
    const all = getParticipants();
    delete all[sessionId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }, [sessionId]);

  return {
    participantId: data?.participantId ?? null,
    nickname: data?.nickname ?? null,
    save,
    clear,
  };
}
