"use client";

import { Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useUser } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/api-client";
import { copyTextWithFallback, generateQrDataUrl } from "@/lib/share-utils";
import { fetchPrivateSpaceInvite, rotatePrivateSpaceInvite } from "@/lib/space-invite-client";
import { cn } from "@/lib/utils";

interface ShareVoteButtonProps {
  joinCode: string;
  creatorId: string | null;
  status: string;
  isLocked: boolean;
  spaceVisibility?: "OPEN" | "PRIVATE" | null;
  spaceId?: string | null;
  canShareSpaceInvite?: boolean;
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
  spaceVisibility = null,
  spaceId = null,
  canShareSpaceInvite = false,
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
  const [spaceInviteCode, setSpaceInviteCode] = useState("");
  const [spaceInviteExpiresAt, setSpaceInviteExpiresAt] = useState("");
  const [spaceInviteLoading, setSpaceInviteLoading] = useState(false);
  const [spaceInviteBusy, setSpaceInviteBusy] = useState(false);
  const [spaceInviteError, setSpaceInviteError] = useState("");
  const [includeSpaceInvite, setIncludeSpaceInvite] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const canShare =
    canShareOverride || !!canShareSpaceInvite || (!!creatorId && creatorId === userId);
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
    if (includeSpaceInvite && spaceInviteCode) {
      link.searchParams.set("spaceInvite", spaceInviteCode);
    }
    return link.toString();
  }, [includeSpaceInvite, joinCode, spaceInviteCode]);

  const prepareQrCode = useCallback(async () => {
    setQrLoading(true);
    setQrError("");
    try {
      const dataUrl = await generateQrDataUrl(buildJoinLink());
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
    const copied = await copyTextWithFallback(joinCode);
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = async () => {
    setCopyError("");
    const copied = await copyTextWithFallback(buildJoinLink());
    if (!copied) {
      setCopyError("Copy failed on this device. Please copy manually.");
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const isPrivateSpaceVote = spaceVisibility === "PRIVATE";
  const canIncludeSpaceInvite = isPrivateSpaceVote && !!spaceId && canShareSpaceInvite;

  const loadSpaceInvite = useCallback(async () => {
    if (!spaceId || !canIncludeSpaceInvite) return;
    setSpaceInviteLoading(true);
    setSpaceInviteError("");
    try {
      const invite = await fetchPrivateSpaceInvite(spaceId);
      const code = invite?.code ?? "";
      const expiresAt = invite?.expiresAt ?? "";
      setSpaceInviteCode(code);
      setSpaceInviteExpiresAt(expiresAt);
      setQrCodeDataUrl("");
      if (!code) {
        setIncludeSpaceInvite(false);
      }
    } catch (error) {
      setSpaceInviteCode("");
      setSpaceInviteExpiresAt("");
      setIncludeSpaceInvite(false);
      setQrCodeDataUrl("");
      setSpaceInviteError(getErrorMessage(error, "Could not load space invite"));
    } finally {
      setSpaceInviteLoading(false);
    }
  }, [canIncludeSpaceInvite, spaceId]);

  const createSpaceInvite = async () => {
    if (!spaceId || !canIncludeSpaceInvite || spaceInviteBusy) return;
    setSpaceInviteBusy(true);
    setSpaceInviteError("");
    try {
      const invite = await rotatePrivateSpaceInvite(spaceId);
      const code = invite.code;
      const expiresAt = invite.expiresAt;
      if (!code) {
        setSpaceInviteError("Could not generate space invite");
        return;
      }
      setSpaceInviteCode(code);
      setSpaceInviteExpiresAt(expiresAt);
      setIncludeSpaceInvite(true);
      setQrCodeDataUrl("");
    } catch (error) {
      setSpaceInviteError(getErrorMessage(error, "Could not generate space invite"));
    } finally {
      setSpaceInviteBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !canIncludeSpaceInvite) return;
    void loadSpaceInvite();
  }, [open, canIncludeSpaceInvite, loadSpaceInvite]);

  const statusMessage =
    status === "OPEN"
      ? isLocked
        ? "Voting is open, but joins are currently locked."
        : isPrivateSpaceVote
          ? "Voting is open for current space members."
          : "Voting is open. Anyone with this link can join."
      : isPrivateSpaceVote
        ? "Voting has ended. The same link opens results for space members."
        : "Voting has ended. The same link now opens results.";
  const privateSpacePrompt =
    status === "OPEN"
      ? "People outside the space can open this link, but they will need a space invite before they can vote."
      : "People outside the space can open this link, but they will need a space invite before they can view results.";
  const formattedSpaceInviteExpiry = spaceInviteExpiresAt
    ? new Date(spaceInviteExpiresAt).toLocaleDateString()
    : null;

  if (!shouldRender) return null;

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
          {isPrivateSpaceVote && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
              <p className="text-xs uppercase tracking-wider text-sky-200">Private Space Access</p>
              <p className="mt-1 text-sm text-sky-100">{privateSpacePrompt}</p>
              {canIncludeSpaceInvite ? (
                <div className="mt-3 rounded-lg border border-sky-400/20 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-sky-100">
                        Include space invite in shared link
                      </p>
                      <p className="text-xs text-sky-200/80">
                        Optional. Recipients can join the private space and continue to the vote in
                        one flow.
                      </p>
                      <p className="text-xs text-sky-200/70">
                        {includeSpaceInvite
                          ? "This shared link includes the active invite."
                          : "This shared link does not include the invite. Recipients must already be members or use a separate invite code."}
                      </p>
                      {formattedSpaceInviteExpiry ? (
                        <p className="text-xs text-sky-200/70">
                          Invite expires on {formattedSpaceInviteExpiry}.
                        </p>
                      ) : null}
                    </div>
                    <input
                      type="checkbox"
                      aria-label="Include space invite"
                      className="mt-0.5 h-4 w-4 accent-amber-400"
                      checked={includeSpaceInvite}
                      onChange={(event) => {
                        setIncludeSpaceInvite(event.target.checked);
                        setQrCodeDataUrl("");
                      }}
                      disabled={!spaceInviteCode || spaceInviteLoading || spaceInviteBusy}
                    />
                  </div>
                  {!spaceInviteCode && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 !text-xs sm:!px-3 sm:!py-1.5 sm:!text-xs"
                        onClick={() => void createSpaceInvite()}
                        disabled={spaceInviteBusy || spaceInviteLoading}
                      >
                        {spaceInviteBusy
                          ? "Generating..."
                          : spaceInviteLoading
                            ? "Loading..."
                            : "Generate invite"}
                      </Button>
                      <p className="text-xs text-sky-200/70">No active space invite found yet.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

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
                  Share the link directly, or let people scan the QR code on mobile. Anyone with a
                  valid link/code can access this vote based on its visibility settings.
                </p>
              </div>
            </div>

            {(copyError || qrError) && (
              <div className="space-y-2">
                {copyError && <ErrorMessage message={copyError} />}
                {qrError && <ErrorMessage message={qrError} />}
              </div>
            )}
            {spaceInviteError && <ErrorMessage message={spaceInviteError} />}
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
