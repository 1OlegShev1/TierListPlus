"use client";

import { Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

interface ShareVoteButtonProps {
  joinCode: string;
  creatorId: string | null;
  status: string;
  isLocked: boolean;
  className?: string;
  label?: string;
  iconOnly?: boolean;
  canShareOverride?: boolean;
}

export function ShareVoteButton({
  joinCode,
  creatorId,
  status,
  isLocked,
  className,
  label = "Share link",
  iconOnly = false,
  canShareOverride = false,
}: ShareVoteButtonProps) {
  const { userId } = useUser();
  const [open, setOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const canShare = canShareOverride || (!!creatorId && creatorId === userId);
  const shouldRender = canShare;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const buildJoinLink = useCallback(() => {
    const link = new URL(
      "/sessions/join",
      typeof window === "undefined" ? "https://tierlistplus.local" : window.location.origin,
    );
    link.searchParams.set("code", joinCode);
    return link.toString();
  }, [joinCode]);

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

  const prepareQrCode = useCallback(async () => {
    setQrLoading(true);
    setQrError("");
    try {
      const qrCodeModule = await import("qrcode");
      const toDataUrl = qrCodeModule.toDataURL ?? qrCodeModule.default?.toDataURL;

      if (!toDataUrl) {
        throw new Error("QR generation is not available.");
      }

      const dataUrl = await toDataUrl(buildJoinLink(), {
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
  }, [buildJoinLink]);

  useEffect(() => {
    if (!open || qrCodeDataUrl || qrLoading) return;
    void prepareQrCode();
  }, [open, qrCodeDataUrl, qrLoading, prepareQrCode]);

  const copyCode = async () => {
    setCopyError("");
    const copied = await copyText(joinCode);
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = async () => {
    setCopyError("");
    const copied = await copyText(buildJoinLink());
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!shouldRender) return null;

  const statusMessage =
    status === "OPEN"
      ? isLocked
        ? "Voting is open, but joins are currently locked."
        : "Voting is open. Anyone with this link can join."
      : "Voting has ended. The same link now opens results.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={cn(
          iconOnly
            ? "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 transition-colors hover:bg-neutral-800"
            : "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-neutral-700 px-3 text-sm text-neutral-300 transition-colors hover:bg-neutral-800",
          className,
        )}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {!iconOnly && <span>{label}</span>}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-[min(calc(100vw-2rem),42rem)] rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-left text-white shadow-2xl shadow-black/60 backdrop:bg-black/70 focus:outline-none"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4">
            <p className="text-xs uppercase tracking-wider text-amber-200">Invite People</p>
            <h3 className="mt-1 text-xl font-semibold text-neutral-100">Share this vote</h3>
            <p className="mt-1 text-sm text-neutral-400">{statusMessage}</p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-700 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Join code</p>
              <p className="mt-1 font-mono text-lg tracking-widest text-amber-300">{joinCode}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-start">
              <div className="rounded-lg border border-neutral-700 bg-white p-3 shadow-lg shadow-black/30">
                {qrLoading ? (
                  <p className="text-sm text-neutral-700">Preparing QR...</p>
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR code for vote invite"
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
              disabled={qrLoading}
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
