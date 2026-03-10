"use client";

import { Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { getErrorMessage } from "@/lib/api-client";
import { copyTextWithFallback, generateQrDataUrl } from "@/lib/share-utils";
import {
  fetchPrivateSpaceInvite,
  type PrivateSpaceInvitePayload,
  rotatePrivateSpaceInvite,
} from "@/lib/space-invite-client";

export function SpaceInvitePanel({ spaceId }: { spaceId: string }) {
  const [invite, setInvite] = useState<PrivateSpaceInvitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let mounted = true;
    const loadInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPrivateSpaceInvite(spaceId);
        if (!mounted) return;
        setInvite(payload);
      } catch (err) {
        if (!mounted) return;
        setError(getErrorMessage(err, "Could not load invite code"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void loadInvite();
    return () => {
      mounted = false;
    };
  }, [spaceId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const buildInviteLink = useCallback(() => {
    const link = new URL(
      "/spaces",
      typeof window === "undefined" ? "https://tierlistplus.local" : window.location.origin,
    );
    link.searchParams.set("joinCode", invite?.code ?? "");
    return link.toString();
  }, [invite?.code]);

  const prepareQrCode = useCallback(async () => {
    if (!invite) return;
    setQrLoading(true);
    setQrError("");
    try {
      const dataUrl = await generateQrDataUrl(buildInviteLink());
      setQrCodeDataUrl(dataUrl);
    } catch {
      setQrError("Could not generate QR code for this invite.");
    } finally {
      setQrLoading(false);
    }
  }, [buildInviteLink, invite]);

  useEffect(() => {
    if (!open || !invite || qrCodeDataUrl || qrLoading) return;
    void prepareQrCode();
  }, [open, invite, qrCodeDataUrl, qrLoading, prepareQrCode]);

  const rotateInvite = async () => {
    if (busy) return;
    const isRotate = !!invite;
    setBusy(true);
    setError(null);
    setNotice(null);
    setQrCodeDataUrl("");
    try {
      const payload = await rotatePrivateSpaceInvite(spaceId);
      setInvite(payload);
      const expiresOn = new Date(payload.expiresAt).toLocaleDateString();
      setNotice(
        isRotate
          ? `Invite rotated. People can join this space until ${expiresOn}. Previous invite links were revoked.`
          : `Invite created. People can join this space until ${expiresOn}. Rotate to revoke it anytime.`,
      );
    } catch (err) {
      setNotice(null);
      setError(getErrorMessage(err, "Could not rotate invite code"));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!invite) return;
    setCopyError("");
    const copied = await copyTextWithFallback(invite.code);
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = async () => {
    if (!invite) return;
    setCopyError("");
    const copied = await copyTextWithFallback(buildInviteLink());
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--fg-primary)]">Private Invite</h3>
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">
          Single reusable code with 7-day expiry.
        </p>
        {invite && (
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            This is the active invite. Anyone with it can join until{" "}
            {new Date(invite.expiresAt).toLocaleDateString()}.
          </p>
        )}
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">
          Rotate invite to immediately disable previously shared links.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={rotateInvite} disabled={busy || loading}>
            {busy ? "Generating..." : invite ? "Rotate code" : "Generate code"}
          </Button>
          {invite ? (
            <Button
              variant="secondary"
              onClick={() => {
                setCopyError("");
                setQrError("");
                setCodeCopied(false);
                setLinkCopied(false);
                setOpen(true);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share invite
              </span>
            </Button>
          ) : null}
        </div>

        {invite ? (
          <p className="mt-3 font-mono text-xs tracking-[0.18em] text-[var(--accent-primary)]">
            {invite.code}
          </p>
        ) : loading ? (
          <p className="mt-3 text-xs text-[var(--fg-subtle)]">Loading invite code...</p>
        ) : (
          <p className="mt-3 text-xs text-[var(--fg-subtle)]">No active invite code yet.</p>
        )}

        {error && (
          <div className="mt-3">
            <ErrorMessage message={error} />
          </div>
        )}
        {notice && (
          <div className="mt-3 rounded-lg border border-[var(--state-success-fg)] bg-[var(--state-success-bg)] px-3 py-2 text-xs text-[var(--state-success-fg)]">
            {notice}
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-[min(calc(100vw-2rem),42rem)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-left text-[var(--fg-primary)] shadow-2xl shadow-black/60 backdrop:bg-[var(--bg-overlay)] focus:outline-none"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-soft-contrast)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--accent-primary)]">
              Invite People
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--fg-primary)]">
              Share this space
            </h3>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Anyone with this code can join while the invite is active.
            </p>
            {invite ? (
              <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                Active until {new Date(invite.expiresAt).toLocaleDateString()}. Rotate invite to
                revoke old links.
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft-contrast)] p-3">
              <p className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">
                Invite code
              </p>
              <p className="mt-1 font-mono text-lg tracking-widest text-[var(--accent-primary)]">
                {invite?.code ?? "No active code"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-start">
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 shadow-lg shadow-black/30">
                {qrLoading ? (
                  <p className="text-sm text-[var(--fg-muted)]">Preparing QR...</p>
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR code for space invite"
                    className="w-full rounded"
                  />
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">QR code unavailable.</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={copyCode} className="!px-4 !py-2 !text-sm">
                    {codeCopied ? "Code copied" : "Copy code"}
                  </Button>
                  <Button variant="secondary" onClick={copyLink} className="!px-4 !py-2 !text-sm">
                    {linkCopied ? "Link copied" : "Copy full link"}
                  </Button>
                </div>
                <p className="text-xs text-[var(--fg-subtle)]">
                  Share the link directly, or let people scan the QR code on mobile. Anyone with an
                  active code can join this private space.
                </p>
              </div>
            </div>

            {(copyError || qrError) && (
              <div className="space-y-2">
                {copyError && <ErrorMessage message={copyError} />}
                {qrError && <ErrorMessage message={qrError} />}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => void prepareQrCode()}
              disabled={qrLoading || !invite}
              className="!px-4 !py-2 !text-sm"
            >
              {qrLoading ? "Preparing..." : "Regenerate QR"}
            </Button>
            <Button onClick={() => setOpen(false)} className="!px-5 !py-2 !text-sm">
              Done
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
