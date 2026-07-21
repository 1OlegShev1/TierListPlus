"use client";

import { useEffect, useState } from "react";
import {
  ensureUserIdentity,
  getLocalDeviceId,
  getLocalUserId,
  IdentityRecoveryRequiredError,
  type SessionFailureCode,
  startFreshIdentity,
} from "@/lib/device-identity";

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
  const [recoveryReason, setRecoveryReason] = useState<SessionFailureCode | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    void retryTick;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setRecoveryReason(null);
    ensureUserIdentity()
      .then((identity) => {
        if (!cancelled) {
          setUserId(identity.userId);
          setDeviceId(identity.deviceId);
          setIsLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setUserId(null);
          setDeviceId(null);
          if (cause instanceof IdentityRecoveryRequiredError) {
            setRecoveryReason(cause.code);
            setError(
              "This browser remembers an existing workspace, but its secure session is missing. Restore it from Devices or explicitly start fresh.",
            );
          } else {
            setError("Could not initialize your device identity. Please retry.");
          }
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

  const startFresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const identity = await startFreshIdentity();
      setUserId(identity.userId);
      setDeviceId(identity.deviceId);
      setRecoveryReason(null);
      return identity;
    } catch {
      setError("Could not create a fresh workspace. Please retry.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    userId,
    deviceId,
    isLoading,
    error,
    retry,
    needsRecovery: recoveryReason != null,
    recoveryReason,
    startFresh,
  };
}
