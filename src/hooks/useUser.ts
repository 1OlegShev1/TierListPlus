"use client";

import { useEffect, useState } from "react";
import { ensureUserId, getLocalUserId } from "@/lib/device-identity";

/**
 * Hook that ensures a device-level user identity exists.
 * Auto-creates a User record on first visit.
 * Returns { userId, isLoading }.
 */
export function useUser() {
  const [userId, setUserId] = useState<string | null>(() => getLocalUserId());
  const [isLoading, setIsLoading] = useState(!userId);

  useEffect(() => {
    if (userId) return;
    let cancelled = false;
    ensureUserId()
      .then((id) => {
        if (!cancelled) {
          setUserId(id);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { userId, isLoading };
}
