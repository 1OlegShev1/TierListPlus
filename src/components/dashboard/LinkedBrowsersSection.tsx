"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ChevronDownIcon } from "@/components/ui/icons";
import { apiDelete, apiFetch, apiPatch, getErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface DeviceSummary {
  id: string;
  displayName: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export interface ActiveLinkCodeSummary {
  linkCode: string;
  expiresAt: string;
}

interface DevicesResponse {
  currentDeviceId: string;
  devices: DeviceSummary[];
  activeLinkCode: ActiveLinkCodeSummary | null;
}

interface RenameDeviceResponse {
  id: string;
  displayName: string;
}

interface LinkedBrowsersSectionProps {
  userId: string | null;
  userLoading: boolean;
  onActiveLinkCodeChange: (activeLinkCode: ActiveLinkCodeSummary | null) => void;
}

export function LinkedBrowsersSection({
  userId,
  userLoading,
  onActiveLinkCodeChange,
}: LinkedBrowsersSectionProps) {
  const [showLinkedBrowsers, setShowLinkedBrowsers] = useState(false);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState("");
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState("");
  const [renamingDeviceId, setRenamingDeviceId] = useState<string | null>(null);
  const [renameError, setRenameError] = useState("");
  const renameInFlightRef = useRef(false);

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setDevices([]);
      setLoadError("");
      onActiveLinkCodeChange(null);
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
        onActiveLinkCodeChange(data.activeLinkCode);
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
  }, [onActiveLinkCodeChange, userId, userLoading]);

  const revokeDevice = async (deviceId: string) => {
    setRevokingDeviceId(deviceId);
    setRevokeError("");
    setRenameError("");

    try {
      await apiDelete(`/api/users/devices/${deviceId}`);
      setDevices((prev) => prev.filter((device) => device.id !== deviceId));
      if (editingDeviceId === deviceId) {
        setEditingDeviceId(null);
        setEditingDeviceName("");
      }
    } catch (err) {
      setRevokeError(getErrorMessage(err, "Failed to revoke device"));
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const startRenamingDevice = (device: DeviceSummary) => {
    if (renamingDeviceId) return;
    setEditingDeviceId(device.id);
    setEditingDeviceName(device.displayName);
    setRenameError("");
  };

  const cancelRenamingDevice = () => {
    if (renamingDeviceId) return;
    setEditingDeviceId(null);
    setEditingDeviceName("");
    setRenameError("");
  };

  const renameDevice = async (deviceId: string) => {
    if (renameInFlightRef.current) return;

    const nextDisplayName = editingDeviceName.trim();
    if (!nextDisplayName) return;

    const currentDevice = devices.find((device) => device.id === deviceId);
    if (currentDevice && currentDevice.displayName === nextDisplayName) {
      setEditingDeviceId(null);
      setEditingDeviceName("");
      return;
    }

    renameInFlightRef.current = true;
    setRenamingDeviceId(deviceId);
    setRenameError("");
    setRevokeError("");
    try {
      const updated = await apiPatch<RenameDeviceResponse>(`/api/users/devices/${deviceId}`, {
        displayName: nextDisplayName,
      });
      setDevices((prev) =>
        prev.map((device) =>
          device.id === updated.id ? { ...device, displayName: updated.displayName } : device,
        ),
      );
      setEditingDeviceId(null);
      setEditingDeviceName("");
    } catch (err) {
      setRenameError(getErrorMessage(err, "Failed to rename device"));
    } finally {
      renameInFlightRef.current = false;
      setRenamingDeviceId(null);
    }
  };

  return (
    <section className="group mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)] p-4 transition-colors hover:border-[var(--border-default)] sm:p-5">
      <button
        type="button"
        onClick={() => setShowLinkedBrowsers((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-expanded={showLinkedBrowsers}
        aria-controls="linked-browsers-content"
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--fg-primary)]">
            3. Linked Browsers & Access
          </h3>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Review linked browsers, check last activity, and revoke access when needed.
          </p>
        </div>
        <ChevronDownIcon
          className={`h-6 w-6 text-[var(--fg-subtle)] transition-all group-hover:text-[var(--fg-secondary)] ${showLinkedBrowsers ? "rotate-180" : ""}`}
        />
      </button>

      {showLinkedBrowsers ? (
        <div id="linked-browsers-content" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-[var(--fg-muted)]">Linked browsers</p>
            {loading && <span className="text-xs text-[var(--fg-subtle)]">Loading...</span>}
          </div>
          {loadError && <ErrorMessage message={loadError} />}
          {revokeError && <ErrorMessage message={revokeError} />}
          {renameError && <ErrorMessage message={renameError} />}
          {!loading && devices.length === 0 ? (
            <p className="text-sm text-[var(--fg-subtle)]">No other browsers linked yet.</p>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const isEditing = editingDeviceId === device.id;
                const isRenaming = renamingDeviceId === device.id;
                const disableRenameSave = !editingDeviceName.trim();

                return (
                  <div
                    key={device.id}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={editingDeviceName}
                            onChange={(e) => setEditingDeviceName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void renameDevice(device.id);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRenamingDevice();
                              }
                            }}
                            maxLength={50}
                            className="h-9 w-full sm:w-80"
                          />
                        ) : (
                          <p className="font-medium text-[var(--fg-primary)]">
                            {device.displayName}
                          </p>
                        )}
                        {device.isCurrent && (
                          <span className="rounded-full border border-[var(--accent-primary)]/50 bg-[var(--bg-soft-contrast)] px-2 py-0.5 text-xs font-medium text-[var(--accent-primary-hover)]">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                        Created {formatDate(device.createdAt)} &middot; Last activity{" "}
                        {formatDate(device.lastSeenAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      {isEditing ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => renameDevice(device.id)}
                            disabled={isRenaming || disableRenameSave}
                            className="!px-3 !py-1.5 !text-xs"
                          >
                            {isRenaming ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={cancelRenamingDevice}
                            disabled={isRenaming}
                            className="text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => startRenamingDevice(device)}
                            disabled={Boolean(renamingDeviceId)}
                            className="text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
                          >
                            Rename
                          </Button>
                          {!device.isCurrent && (
                            <Button
                              variant="ghost"
                              onClick={() => revokeDevice(device.id)}
                              disabled={revokingDeviceId === device.id}
                              className="text-[var(--state-danger-fg)] hover:text-[var(--action-danger-bg-hover)]"
                            >
                              {revokingDeviceId === device.id ? "Revoking..." : "Revoke"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
