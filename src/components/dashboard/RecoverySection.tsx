"use client";

import { useEffect, useRef, useState } from "react";
import {
  type ActiveLinkCodeSummary,
  LinkedBrowsersSection,
} from "@/components/dashboard/LinkedBrowsersSection";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { clearAllParticipants } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import { saveLocalIdentity } from "@/lib/device-identity";

interface LinkCodePayload {
  linkCode: string;
  expiresAt: string;
}

export function RecoverySection() {
  const { userId, isLoading: userLoading, error: userError, needsRecovery, startFresh } = useUser();
  const [activeLinkCode, setActiveLinkCode] = useState<ActiveLinkCodeSummary | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [qrLinkUrl, setQrLinkUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrRefreshing, setQrRefreshing] = useState(false);
  const [qrLinkCopied, setQrLinkCopied] = useState(false);
  const [qrError, setQrError] = useState("");
  const qrDialogRef = useRef<HTMLDialogElement>(null);

  const [linkCode, setLinkCode] = useState("");
  const [codePrefilledFromLink, setCodePrefilledFromLink] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linked, setLinked] = useState(false);
  const [showStartFreshConfirm, setShowStartFreshConfirm] = useState(false);
  const [startingFresh, setStartingFresh] = useState(false);

  useEffect(() => {
    const rawLinkCode = new URLSearchParams(window.location.search).get("linkCode");
    if (!rawLinkCode) return;
    setLinkCode(rawLinkCode.trim().toUpperCase());
    setCodePrefilledFromLink(true);
  }, []);

  useEffect(() => {
    const dialog = qrDialogRef.current;
    if (!dialog) return;
    if (showQrModal && !dialog.open) dialog.showModal();
    if (!showQrModal && dialog.open) dialog.close();
  }, [showQrModal]);

  const requestNewLinkCode = async (): Promise<LinkCodePayload> => {
    if (!userId) {
      throw new Error("Sign in on this browser before linking another one.");
    }

    const data = await apiPost<LinkCodePayload>(`/api/users/${userId}/recovery`, {});
    setActiveLinkCode({ linkCode: data.linkCode, expiresAt: data.expiresAt });
    return data;
  };

  const copyText = async (value: string) => {
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  };

  const generateCode = async () => {
    if (!userId) return;
    setGenerating(true);
    setGenerateError("");
    try {
      await requestNewLinkCode();
    } catch (err) {
      setGenerateError(getErrorMessage(err, "Failed to generate link code"));
    } finally {
      setGenerating(false);
    }
  };

  const createQrCodeData = async (code: string) => {
    const linkUrl = new URL("/devices", window.location.origin);
    linkUrl.searchParams.set("linkCode", code);
    const qrCodeModule = await import("qrcode");
    const toDataUrl = qrCodeModule.toDataURL ?? qrCodeModule.default?.toDataURL;

    if (!toDataUrl) {
      throw new Error("QR generation is not available.");
    }

    const dataUrl = await toDataUrl(linkUrl.toString(), {
      width: 320,
      margin: 1,
      color: {
        dark: "#111111",
        light: "#ffffff",
      },
    });

    return { dataUrl, linkUrl: linkUrl.toString() };
  };

  const openQrModal = async () => {
    if (qrLoading) return;

    setQrLoading(true);
    setQrError("");

    try {
      const currentCode = activeLinkCode ?? (await requestNewLinkCode());
      const { dataUrl, linkUrl } = await createQrCodeData(currentCode.linkCode);
      setQrCodeDataUrl(dataUrl);
      setQrLinkUrl(linkUrl);
      setQrLinkCopied(false);
      setShowQrModal(true);
    } catch (err) {
      setQrError(getErrorMessage(err, "Failed to prepare QR code"));
    } finally {
      setQrLoading(false);
    }
  };

  const refreshQrCode = async () => {
    if (qrRefreshing) return;
    setQrRefreshing(true);
    setQrError("");
    try {
      const nextCode = await requestNewLinkCode();
      const { dataUrl, linkUrl } = await createQrCodeData(nextCode.linkCode);
      setQrCodeDataUrl(dataUrl);
      setQrLinkUrl(linkUrl);
      setQrLinkCopied(false);
      setCopied(false);
    } catch (err) {
      setQrError(getErrorMessage(err, "Failed to refresh link code"));
    } finally {
      setQrRefreshing(false);
    }
  };

  const copyCode = async () => {
    if (!activeLinkCode) return;
    setCopyError("");

    try {
      const didCopy = await copyText(activeLinkCode.linkCode);
      if (!didCopy) {
        throw new Error("Copy failed");
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy failed on this device. Please select the code manually.");
    }
  };

  const copyQrLink = async () => {
    if (!qrLinkUrl) return;
    const didCopy = await copyText(qrLinkUrl);
    if (!didCopy) {
      setCopyError("Copy failed on this device. Please select the code manually.");
      return;
    }

    setQrLinkCopied(true);
    setTimeout(() => setQrLinkCopied(false), 2000);
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

  const confirmStartFresh = async () => {
    setStartingFresh(true);
    const identity = await startFresh();
    if (identity) {
      clearAllParticipants();
      setShowStartFreshConfirm(false);
      window.location.reload();
      return;
    }
    setStartingFresh(false);
  };

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-6">
      {needsRecovery ? (
        <section className="mb-4 rounded-xl border border-[var(--accent-primary)]/45 bg-[var(--accent-primary)]/10 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-[var(--fg-primary)]">
            Restore this browser&apos;s workspace
          </h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            This Chrome profile remembers an existing workspace, but its secure session cookie is
            missing or no longer valid. TierList+ has not created a replacement account.
          </p>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Generate a one-time link code from another linked browser, then enter it below. If you
            intentionally want an empty workspace, you can start fresh.
          </p>
          <div className="mt-3">
            <Button
              variant="ghost"
              onClick={() => setShowStartFreshConfirm(true)}
              className="text-[var(--state-danger-fg)] hover:text-[var(--action-danger-bg-hover)]"
            >
              Start with a new empty workspace
            </Button>
          </div>
          {userError ? <ErrorMessage message={userError} /> : null}
        </section>
      ) : null}

      <h2 className="mb-3 text-base font-semibold text-[var(--fg-secondary)] sm:mb-4 sm:text-lg">
        Link Another Browser
      </h2>

      {!needsRecovery ? (
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--fg-secondary)]">
            1. Generate Code (Current Browser)
          </h3>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Create a one-time code here, then use it in another browser within 15 minutes.
          </p>
          <div className="mt-3">
            {activeLinkCode ? (
              <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">
                    One-time code
                  </p>
                  <p className="text-xs text-[var(--fg-subtle)]">
                    Expires{" "}
                    {new Date(activeLinkCode.expiresAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <code className="block rounded-lg bg-[var(--bg-surface-hover)] px-3 py-2 text-center font-mono text-sm tracking-wide text-[var(--accent-primary)] sm:px-4 sm:py-2.5 sm:text-lg sm:tracking-wider sm:text-left">
                  {activeLinkCode.linkCode}
                </code>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={copyCode} className="!px-4 !py-2 !text-sm">
                    {copied ? "Copied!" : "Copy Code"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={generateCode}
                    disabled={generating || !userId}
                    className="!px-4 !py-2 !text-sm"
                  >
                    {generating ? "Refreshing..." : "Generate New Code"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={openQrModal}
                    disabled={qrLoading || !userId}
                    className="!px-4 !py-2 !text-sm"
                  >
                    {qrLoading ? "Preparing QR..." : "Show QR for Phone"}
                  </Button>
                </div>
                <p className="text-xs text-[var(--fg-subtle)]">
                  Phone shortcut: scan QR with your camera. It opens TierList+ in your phone&apos;s
                  default browser and links that browser profile only.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={generateCode}
                  disabled={generating || !userId}
                  className="!px-4 !py-2 !text-sm"
                >
                  {generating ? "Generating..." : "Generate Link Code"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={openQrModal}
                  disabled={qrLoading || !userId}
                  className="!px-4 !py-2 !text-sm"
                >
                  {qrLoading ? "Preparing QR..." : "Show QR for Phone"}
                </Button>
              </div>
            )}
          </div>
          {generateError && <ErrorMessage message={generateError} />}
          {copyError && <ErrorMessage message={copyError} />}
          {qrError && <ErrorMessage message={qrError} />}
        </section>
      ) : null}

      <section className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[var(--fg-secondary)]">
          {needsRecovery ? "Restore This Browser" : "2. Link This Browser"}
        </h3>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Enter a one-time code manually, or open this page from a QR link to pre-fill it.
        </p>
        {codePrefilledFromLink && linkCode.trim() ? (
          <p className="mt-3 rounded-lg border border-[var(--state-success-fg)]/40 bg-[var(--state-success-bg)] px-3 py-2 text-xs text-[var(--state-success-fg)]">
            Code pre-filled from QR link. Add a browser label and finish linking.
          </p>
        ) : null}
        <div className="mt-3">
          {linked ? (
            <p className="text-sm text-[var(--state-success-fg)]">
              Browser linked successfully! Reloading...
            </p>
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
                placeholder="Browser label (e.g., iPhone Safari, Work Chrome)"
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
                {linking ? "Linking..." : "Link This Browser"}
              </Button>
            </div>
          )}
        </div>
        {linkError && <ErrorMessage message={linkError} />}
      </section>

      {!needsRecovery ? (
        <LinkedBrowsersSection
          userId={userId}
          userLoading={userLoading}
          onActiveLinkCodeChange={setActiveLinkCode}
        />
      ) : null}

      <ConfirmDialog
        open={showStartFreshConfirm}
        title="Start a new empty workspace?"
        description="This explicitly creates a new anonymous account in this browser. It will not delete the remembered account, but you will need a link code or future recovery method to return to it."
        confirmLabel="Start Fresh"
        loadingLabel="Creating..."
        confirmVariant="danger"
        loading={startingFresh}
        onConfirm={confirmStartFresh}
        onCancel={() => setShowStartFreshConfirm(false)}
      />

      <dialog
        ref={qrDialogRef}
        onClose={() => setShowQrModal(false)}
        className="fixed inset-0 m-auto w-[min(calc(100vw-2rem),42rem)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-left text-[var(--fg-primary)] shadow-2xl shadow-black/60 backdrop:bg-[var(--bg-overlay)] focus:outline-none"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--bg-elevated)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--accent-primary-hover)]">
              Phone Shortcut
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--fg-primary)]">
              Open on phone browser
            </h3>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Scan with your phone camera. This opens TierList+ in your phone&apos;s default browser
              with the one-time code pre-filled. It links that browser profile only.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-start">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-lg shadow-black/30">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR code for linking a second device"
                  className="w-full rounded"
                />
              ) : (
                <p className="text-sm text-[var(--fg-secondary)]">QR code unavailable.</p>
              )}
            </div>
            <div className="space-y-3">
              {activeLinkCode && (
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
                  <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">
                    One-time code
                  </p>
                  <p className="mt-1 font-mono text-sm tracking-widest text-[var(--accent-primary)]">
                    {activeLinkCode.linkCode}
                  </p>
                  <p className="mt-2 text-xs text-[var(--fg-subtle)]">
                    Expires{" "}
                    {new Date(activeLinkCode.expiresAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={copyCode} className="!px-4 !py-2 !text-sm">
                  {copied ? "Code Copied" : "Copy Code"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={copyQrLink}
                  disabled={!qrLinkUrl}
                  className="!px-4 !py-2 !text-sm"
                >
                  {qrLinkCopied ? "Link Copied" : "Copy Link"}
                </Button>
              </div>
              {copyError && <ErrorMessage message={copyError} />}
            </div>
          </div>
          {qrError && <ErrorMessage message={qrError} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={refreshQrCode}
              disabled={qrRefreshing || !userId}
              className="!px-4 !py-2 !text-sm"
            >
              {qrRefreshing ? "Refreshing..." : "Refresh Code"}
            </Button>
            <Button onClick={() => setShowQrModal(false)} className="!px-5 !py-2 !text-sm">
              Done
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
