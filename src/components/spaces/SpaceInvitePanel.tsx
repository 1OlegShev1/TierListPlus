"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";

interface InvitePayload {
  code: string;
  expiresAt: string;
}

export function SpaceInvitePanel({ spaceId }: { spaceId: string }) {
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const payload = await apiFetch<{ invite: InvitePayload | null }>(
          `/api/spaces/${spaceId}/invite`,
        );
        if (!mounted) return;
        setInvite(payload.invite);
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

  const buildInviteLink = () => {
    const link = new URL(
      "/spaces",
      typeof window === "undefined" ? "https://tierlistplus.local" : window.location.origin,
    );
    link.searchParams.set("joinCode", invite?.code ?? "");
    return link.toString();
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

  const prepareQrCode = async () => {
    if (!invite) return;
    setQrLoading(true);
    setQrError("");
    try {
      const qrCodeModule = await import("qrcode");
      const toDataUrl = qrCodeModule.toDataURL ?? qrCodeModule.default?.toDataURL;
      if (!toDataUrl) {
        throw new Error("QR generation is not available.");
      }
      const dataUrl = await toDataUrl(buildInviteLink(), {
        width: 300,
        margin: 1,
        color: {
          dark: "#111111",
          light: "#ffffff",
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch {
      setQrError("Could not generate QR code for this invite.");
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !invite || qrCodeDataUrl || qrLoading) return;
    void prepareQrCode();
  }, [open, invite, qrCodeDataUrl, qrLoading]);

  const rotateInvite = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setQrCodeDataUrl("");
    try {
      const payload = await apiPost<InvitePayload>(`/api/spaces/${spaceId}/invite`, {});
      setInvite(payload);
    } catch (err) {
      setError(getErrorMessage(err, "Could not rotate invite code"));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!invite) return;
    setCopyError("");
    const copied = await copyText(invite.code);
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
    const copied = await copyText(buildInviteLink());
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-sm font-semibold text-neutral-100">Private Invite</h3>
        <p className="mt-1 text-xs text-neutral-500">Single reusable code with 7-day expiry.</p>
        {invite && (
          <p className="mt-1 text-xs text-neutral-500">
            Expires {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
        )}

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
          <p className="mt-3 font-mono text-xs tracking-[0.18em] text-amber-300">{invite.code}</p>
        ) : loading ? (
          <p className="mt-3 text-xs text-neutral-500">Loading invite code...</p>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">No active invite code yet.</p>
        )}

        {error && (
          <div className="mt-3">
            <ErrorMessage message={error} />
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-[min(calc(100vw-2rem),42rem)] rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-left text-white shadow-2xl shadow-black/60 backdrop:bg-black/70 focus:outline-none"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4">
            <p className="text-xs uppercase tracking-wider text-amber-200">Invite People</p>
            <h3 className="mt-1 text-xl font-semibold text-neutral-100">Share this space</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Anyone with this code can join while the invite is active.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-700 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Invite code</p>
              <p className="mt-1 font-mono text-lg tracking-widest text-amber-300">
                {invite?.code ?? "No active code"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-start">
              <div className="rounded-lg border border-neutral-700 bg-white p-3 shadow-lg shadow-black/30">
                {qrLoading ? (
                  <p className="text-sm text-neutral-700">Preparing QR...</p>
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR code for space invite"
                    className="w-full rounded"
                  />
                ) : (
                  <p className="text-sm text-neutral-700">QR code unavailable.</p>
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
                <p className="text-xs text-neutral-500">
                  Share the link directly, or let people scan the QR code on mobile.
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
