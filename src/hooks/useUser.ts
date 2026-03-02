"use client";

import { useEffect, useState } from "react";
import { ensureUserIdentity, getLocalDeviceId, getLocalUserId } from "@/lib/device-identity";

/**
 * Hook that ensures a device-level user identity exists.
 * Auto-creates a User record on first visit.
 * Returns { userId, isLoading }.
 */
export function useUser() {
  const [userId, setUserId] = useState<string | null>(() => getLocalUserId());
  const [deviceId, setDeviceId] = useState<string | null>(() => getLocalDeviceId());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    void retryTick;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    ensureUserIdentity()
      .then((identity) => {
        if (!cancelled) {
          setUserId(identity.userId);
          setDeviceId(identity.deviceId);
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
    if (userId && deviceId) return;
    setRetryTick((v) => v + 1);
  };

  return { userId, deviceId, isLoading, error, retry };
}
