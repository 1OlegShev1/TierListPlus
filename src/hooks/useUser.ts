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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    void retryTick;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    ensureUserId()
      .then((id) => {
        if (!cancelled) {
          setUserId(id);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not initialize your device identity. Please retry.");
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const retry = () => {
    if (userId) return;
    setRetryTick((v) => v + 1);
  };

  return { userId, isLoading, error, retry };
}
