"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { clearAllParticipants } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiDelete, apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";
import { saveLocalIdentity } from "@/lib/device-identity";
import { formatDate } from "@/lib/utils";

interface DeviceSummary {
  id: string;
  displayName: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

interface DevicesResponse {
  currentDeviceId: string;
  devices: DeviceSummary[];
  activeLinkCode: { linkCode: string; expiresAt: string } | null;
}

export function RecoverySection() {
  const { userId, isLoading: userLoading } = useUser();
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [activeLinkCode, setActiveLinkCode] = useState<DevicesResponse["activeLinkCode"]>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const [linkCode, setLinkCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linked, setLinked] = useState(false);

  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState("");

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }

    let stale = false;
    setLoading(true);
    setLoadError("");

    apiFetch<DevicesResponse>("/api/users/devices")
      .then((data) => {
        if (stale) return;
        setDevices(data.devices);
        setActiveLinkCode(data.activeLinkCode);
      })
      .catch((err) => {
        if (stale) return;
        setLoadError(getErrorMessage(err, "Failed to load linked devices"));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });

    return () => {
      stale = true;
    };
  }, [userId, userLoading]);

  const generateCode = async () => {
    if (!userId) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const data = await apiPost<{ linkCode: string; expiresAt: string }>(
        `/api/users/${userId}/recovery`,
        {},
      );
      setActiveLinkCode({ linkCode: data.linkCode, expiresAt: data.expiresAt });
    } catch (err) {
      setGenerateError(getErrorMessage(err, "Failed to generate link code"));
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!activeLinkCode) return;
    setCopyError("");

    try {
      let copiedWithClipboard = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(activeLinkCode.linkCode);
          copiedWithClipboard = true;
        } catch {
          copiedWithClipboard = false;
        }
      }

      if (!copiedWithClipboard) {
        const textarea = document.createElement("textarea");
        textarea.value = activeLinkCode.linkCode;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copiedWithFallback = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!copiedWithFallback) {
          throw new Error("Copy failed");
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy failed on this device. Please select the code manually.");
    }
  };

  const linkDevice = async () => {
    if (!linkCode.trim() || !deviceName.trim()) return;

    setLinking(true);
    setLinkError("");

    try {
      const data = await apiPost<{ userId: string; deviceId: string }>("/api/users/recover", {
        recoveryCode: linkCode.trim(),
        deviceName: deviceName.trim(),
      });
      clearAllParticipants();
      saveLocalIdentity({ userId: data.userId, deviceId: data.deviceId });
      setLinked(true);
      window.location.reload();
    } catch (err) {
      setLinkError(getErrorMessage(err, "Invalid link code"));
    } finally {
      setLinking(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    setRevokingDeviceId(deviceId);
    setRevokeError("");

    try {
      await apiDelete(`/api/users/devices/${deviceId}`);
      setDevices((prev) => prev.filter((device) => device.id !== deviceId));
    } catch (err) {
      setRevokeError(getErrorMessage(err, "Failed to revoke device"));
    } finally {
      setRevokingDeviceId(null);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6">
      <h2 className="mb-3 text-base font-semibold text-neutral-300 sm:mb-4 sm:text-lg">
        Move Between Devices
      </h2>

      <div className="mb-6">
        <p className="mb-3 text-sm text-neutral-400">
          Grab a one-time code and use it on another device within 15 minutes.
        </p>
        {activeLinkCode ? (
          <div className="space-y-3">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <code className="rounded-lg bg-neutral-800 px-3 py-1.5 font-mono text-sm tracking-wide text-amber-400 sm:px-4 sm:py-2 sm:text-lg sm:tracking-wider">
                {activeLinkCode.linkCode}
              </code>
              <Button variant="secondary" onClick={copyCode} className="!px-4 !py-2 !text-sm">
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="secondary"
                onClick={generateCode}
                disabled={generating || !userId}
                className="!px-4 !py-2 !text-sm"
              >
                {generating ? "Refreshing..." : "Generate New Code"}
              </Button>
            </div>
            <p className="text-xs text-neutral-500">
              Expires{" "}
              {new Date(activeLinkCode.expiresAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={generateCode}
            disabled={generating || !userId}
            className="!px-4 !py-2 !text-sm"
          >
            {generating ? "Generating..." : "Generate Link Code"}
          </Button>
        )}
        {generateError && <ErrorMessage message={generateError} />}
        {copyError && <ErrorMessage message={copyError} />}
      </div>

      <div className="border-t border-neutral-800 pt-4 sm:pt-6">
        <p className="mb-3 text-sm text-neutral-400">
          Paste a one-time code on this device and choose how it should show up in your list.
        </p>
        {linked ? (
          <p className="text-sm text-green-400">Device linked successfully! Reloading...</p>
        ) : (
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="e.g., TIGER-MAPLE-RIVER-42"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
              className="w-full font-mono tracking-wide sm:tracking-wider"
            />
            <Input
              type="text"
              placeholder="This device name (e.g., iPhone, Work Laptop)"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              maxLength={50}
              className="w-full"
            />
            <Button
              variant="secondary"
              onClick={linkDevice}
              disabled={linking || !linkCode.trim() || !deviceName.trim()}
              className="w-full !px-4 !py-2 !text-sm sm:w-auto"
            >
              {linking ? "Linking..." : "Link This Device"}
            </Button>
          </div>
        )}
        {linkError && <ErrorMessage message={linkError} />}
      </div>

      <div className="mt-6 border-t border-neutral-800 pt-4 sm:pt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-neutral-400">Your devices</p>
          {loading && <span className="text-xs text-neutral-500">Loading...</span>}
        </div>
        {loadError && <ErrorMessage message={loadError} />}
        {revokeError && <ErrorMessage message={revokeError} />}
        {!loading && devices.length === 0 ? (
          <p className="text-sm text-neutral-500">No extra devices linked yet.</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-200">{device.displayName}</p>
                    {device.isCurrent && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Created {formatDate(device.createdAt)} &middot; Last seen{" "}
                    {formatDate(device.lastSeenAt)}
                  </p>
                </div>
                {!device.isCurrent && (
                  <Button
                    variant="ghost"
                    onClick={() => revokeDevice(device.id)}
                    disabled={revokingDeviceId === device.id}
                    className="self-start text-red-400 hover:text-red-300 sm:self-auto"
                  >
                    {revokingDeviceId === device.id ? "Revoking..." : "Revoke"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
