"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";
import { VoteSettingsButton } from "@/components/sessions/VoteSettingsButton";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { CloseIcon, LockClosedIcon, LockOpenIcon } from "@/components/ui/icons";
import { JoinCodeBanner } from "@/components/ui/JoinCodeBanner";
import { ThemedTooltip } from "@/components/ui/ThemedTooltip";
import { useParticipant } from "@/hooks/useParticipant";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import type { SessionData } from "@/types";

const resultsLinkClassName = `${buttonVariants.secondary} !h-10 !px-4 !py-0 !text-sm !font-medium`;
const closeRankingButtonClassName =
  "!border-[var(--state-danger-fg)]/35 !bg-transparent !text-[var(--state-danger-fg)] hover:!border-[var(--state-danger-fg)]/60 hover:!bg-[var(--state-danger-bg)]/50 hover:!text-[var(--state-danger-fg)]";
const titleMaxWidthClassName =
  "min-w-0 max-w-[min(58vw,19rem)] sm:max-w-[min(56vw,25rem)] md:max-w-[min(42vw,31rem)] lg:max-w-[min(38vw,35rem)]";
const editButtonSlotWidthPx = 44;

function StatusNotice({
  tone,
  children,
  onDismiss,
}: {
  tone: "amber" | "emerald";
  children: ReactNode;
  onDismiss: () => void;
}) {
  const toneClassName =
    tone === "emerald"
      ? "border-[var(--state-success-fg)] text-[var(--state-success-fg)]"
      : "border-[var(--accent-primary)] text-[var(--accent-primary-hover)]";
  const toneButtonClassName =
    tone === "emerald"
      ? "text-[var(--state-success-fg)] hover:bg-[var(--state-success-bg)] hover:text-[var(--state-success-fg)]"
      : "text-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent-primary-hover)]";

  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-sm leading-5 backdrop-blur-sm sm:w-[22rem] ${toneClassName}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onDismiss}
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors ${toneButtonClassName}`}
        aria-label="Dismiss notice"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function VotePageClient({
  sessionId,
  session,
  resolvedParticipantId,
  seededTiers,
  currentUserId,
}: {
  sessionId: string;
  session: SessionData;
  resolvedParticipantId: string;
  seededTiers: Record<string, string[]>;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { save: saveParticipant, clear: clearParticipant } = useParticipant(sessionId);
  const [sessionName, setSessionName] = useState(session.name);
  const [participantNickname, setParticipantNickname] = useState(
    session.currentParticipantNickname ?? "Host",
  );
  const [isPrivate, setIsPrivate] = useState(session.isPrivate);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(session.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleHeadingRef = useRef<HTMLHeadingElement>(null);
  const nameCommittingRef = useRef(false);
  const [editingTitleWidthPx, setEditingTitleWidthPx] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(session.isLocked);
  const [lockUpdating, setLockUpdating] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [notices, setNotices] = useState<
    Array<{
      id: number;
      tone: "amber" | "emerald";
      message: string;
      actionHref?: string;
      actionLabel?: string;
    }>
  >([]);
  const noticeIdRef = useRef(0);
  const noticeTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const autoEditNameHandledRef = useRef(false);
  const canEditTierConfig = session.canManageSession;
  const isOwner = session.canManageSession;

  useEffect(() => {
    if (session.currentParticipantId) {
      saveParticipant(session.currentParticipantId, participantNickname);
      return;
    }
    clearParticipant();
  }, [clearParticipant, participantNickname, saveParticipant, session.currentParticipantId]);

  const dismissNotice = (id: number) => {
    const timeout = noticeTimeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      noticeTimeoutsRef.current.delete(id);
    }
    setNotices((current) => current.filter((notice) => notice.id !== id));
  };

  const pushNotice = (notice: {
    tone: "amber" | "emerald";
    message: string;
    actionHref?: string;
    actionLabel?: string;
    durationMs?: number;
  }) => {
    const id = noticeIdRef.current + 1;
    noticeIdRef.current = id;
    setNotices((current) => [
      ...current,
      {
        id,
        tone: notice.tone,
        message: notice.message,
        actionHref: notice.actionHref,
        actionLabel: notice.actionLabel,
      },
    ]);
    const timeout = setTimeout(() => dismissNotice(id), notice.durationMs ?? 3000);
    noticeTimeoutsRef.current.set(id, timeout);
  };

  useEffect(
    () => () => {
      for (const timeout of noticeTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      noticeTimeoutsRef.current.clear();
    },
    [],
  );

  const toggleLock = async () => {
    if (!isOwner || lockUpdating) return;
    setLockUpdating(true);
    setLockError(null);
    try {
      const nextIsLocked = !isLocked;
      await apiPatch(`/api/sessions/${session.id}`, { isLocked: nextIsLocked });
      setIsLocked(nextIsLocked);
      pushNotice({
        tone: nextIsLocked ? "amber" : "emerald",
        message: nextIsLocked
          ? "Joins locked. New participants cannot join right now."
          : "Joins open. New participants can join now.",
        durationMs: 3000,
      });
    } catch (err) {
      setLockError(getErrorMessage(err, "Failed to update session lock"));
    } finally {
      setLockUpdating(false);
    }
  };

  const JoinStatusIcon = isLocked ? LockClosedIcon : LockOpenIcon;
  const backHref = session.spaceId ? `/spaces/${session.spaceId}#votes` : "/sessions";
  const backLabel = session.spaceId ? "Back to Space Rankings" : "Back to Rankings";
  const visibilityBadge = session.spaceId
    ? {
        label: "Space",
        className: "border-[var(--state-muted-fg)]/35 text-[var(--state-muted-fg)]",
      }
    : isPrivate
      ? {
          label: "Private",
          className: "border-[var(--state-danger-fg)]/35 text-[var(--state-danger-fg)]",
        }
      : {
          label: "Public",
          className:
            "border-[var(--source-control-linked-border)] text-[var(--source-control-linked-fg)]",
        };
  const visibilityTooltip = session.spaceId
    ? "Space ranking visibility is controlled by Space settings."
    : "Ranking visibility. Change this in Ranking settings.";

  const startEditingName = () => {
    const measuredTitleWidth = titleHeadingRef.current?.offsetWidth ?? 0;
    setEditingTitleWidthPx(
      measuredTitleWidth > 0 ? measuredTitleWidth + editButtonSlotWidthPx : null,
    );
    nameCommittingRef.current = false;
    setNameDraft(sessionName);
    setNameError(null);
    setIsEditingName(true);
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  };

  const commitName = async () => {
    if (nameCommittingRef.current) return;
    nameCommittingRef.current = true;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === sessionName || !session.canManageSession) {
      setNameDraft(sessionName);
      setIsEditingName(false);
      setEditingTitleWidthPx(null);
      nameCommittingRef.current = false;
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      await apiPatch(`/api/sessions/${session.id}`, { name: trimmed });
      setSessionName(trimmed);
      setIsEditingName(false);
      setEditingTitleWidthPx(null);
    } catch (err) {
      setNameError(getErrorMessage(err, "Could not rename this ranking"));
    } finally {
      setNameSaving(false);
      nameCommittingRef.current = false;
    }
  };

  const cancelEditingName = () => {
    if (nameSaving) return;
    nameCommittingRef.current = true;
    setNameDraft(sessionName);
    setNameError(null);
    setIsEditingName(false);
    setEditingTitleWidthPx(null);
  };

  useEffect(() => {
    if (autoEditNameHandledRef.current) return;
    if (!session.canManageSession) return;
    if (searchParams.get("editName") !== "1") return;
    autoEditNameHandledRef.current = true;
    const measuredTitleWidth = titleHeadingRef.current?.offsetWidth ?? 0;
    setEditingTitleWidthPx(
      measuredTitleWidth > 0 ? measuredTitleWidth + editButtonSlotWidthPx : null,
    );
    nameCommittingRef.current = false;
    setNameDraft(session.name);
    setNameError(null);
    setIsEditingName(true);
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
    router.replace(`/sessions/${sessionId}/vote`, { scroll: false });
  }, [router, searchParams, session.canManageSession, session.name, sessionId]);

  return (
    <div className="relative -mt-2 flex min-w-0 touch-pan-y overflow-x-hidden overscroll-x-none flex-col pb-3 sm:-mt-4 sm:pb-4">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:z-30 sm:justify-end"
      >
        <div className="flex w-full max-w-[22rem] flex-col gap-2">
          {notices.map((notice) => (
            <StatusNotice
              key={notice.id}
              tone={notice.tone}
              onDismiss={() => dismissNotice(notice.id)}
            >
              {notice.message}{" "}
              {notice.actionHref && notice.actionLabel ? (
                <Link
                  href={notice.actionHref}
                  className="font-medium underline underline-offset-2 hover:text-[var(--fg-primary)]"
                >
                  {notice.actionLabel}
                </Link>
              ) : null}
            </StatusNotice>
          ))}
        </div>
      </div>
      <div className="mb-2 flex items-center justify-between sm:mb-3">
        <Link href={backHref} className={`${buttonVariants.ghost} inline-flex items-center`}>
          {`← ${backLabel}`}
        </Link>
        <span className="group relative inline-flex">
          <span
            className={`inline-flex cursor-default rounded-full border px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] transition-colors hover:border-[var(--border-strong)] ${visibilityBadge.className}`}
          >
            {visibilityBadge.label}
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-[calc(100%+0.4rem)] z-20 min-w-[16rem] max-w-[22rem] rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-2 text-[0.72rem] normal-case tracking-normal text-[var(--fg-secondary)] opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
          >
            {`${visibilityTooltip} Current: ${visibilityBadge.label}.`}
          </span>
        </span>
      </div>

      <div className="mb-1.5 flex flex-shrink-0 flex-col gap-2 md:flex-row md:items-start md:justify-between sm:mb-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="inline-flex min-w-0 max-w-full items-center gap-1 sm:gap-1.5">
            <div
              className={`${titleMaxWidthClassName} relative min-w-0`}
              style={
                isEditingName && editingTitleWidthPx
                  ? { width: `${editingTitleWidthPx}px` }
                  : undefined
              }
            >
              {isEditingName ? (
                <>
                  <span
                    aria-hidden
                    className="block invisible truncate text-lg font-bold sm:text-2xl"
                  >
                    {sessionName}
                  </span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={() => void commitName()}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return;
                      if (event.key === "Enter") void commitName();
                      if (event.key === "Escape") cancelEditingName();
                    }}
                    maxLength={100}
                    disabled={nameSaving}
                    className="absolute inset-0 w-full truncate rounded-lg border border-[var(--accent-primary)] bg-transparent px-2 py-0.5 text-lg font-bold text-[var(--fg-primary)] outline-none ring-2 ring-[var(--focus-ring)] sm:text-2xl"
                  />
                </>
              ) : (
                <h1 ref={titleHeadingRef} className="truncate text-lg font-bold sm:text-2xl">
                  {sessionName}
                </h1>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
              {session.canManageSession && !isEditingName && (
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    onClick={startEditingName}
                    aria-label="Edit ranking name"
                    className="peer inline-flex h-10 w-10 items-center justify-center text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <ThemedTooltip className="max-w-[14rem] text-[0.68rem]">
                    Edit ranking name
                  </ThemedTooltip>
                </span>
              )}
              {isOwner ? (
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    onClick={toggleLock}
                    disabled={lockUpdating}
                    aria-label={isLocked ? "Unlock joins" : "Lock joins"}
                    aria-busy={lockUpdating || undefined}
                    className={`peer inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-80 ${
                      isLocked
                        ? "text-[var(--fg-subtle)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--fg-secondary)]"
                        : "text-[var(--state-success-fg)] hover:bg-[var(--state-success-bg)]"
                    }`}
                  >
                    <JoinStatusIcon className="h-5 w-5" />
                  </button>
                  <ThemedTooltip className="max-w-[14rem] text-[0.68rem]">
                    {isLocked ? "Joins locked - click to unlock" : "Joins open - click to lock"}
                  </ThemedTooltip>
                </span>
              ) : (
                <span className="group relative inline-flex">
                  <span
                    className={`peer inline-flex h-10 w-10 items-center justify-center ${
                      isLocked ? "text-[var(--fg-subtle)]" : "text-[var(--state-success-fg)]"
                    }`}
                  >
                    <JoinStatusIcon className="h-5 w-5" />
                  </span>
                  <ThemedTooltip className="max-w-[14rem] text-[0.68rem]">
                    {isLocked ? "Joins locked" : "Joins open"}
                  </ThemedTooltip>
                </span>
              )}
              <VoteSettingsButton
                sessionId={session.id}
                initialNickname={participantNickname}
                initialIsPrivate={isPrivate}
                canManageSession={session.canManageSession}
                isSpaceSession={!!session.spaceId}
                onNicknameChange={setParticipantNickname}
                onPrivacyChange={setIsPrivate}
              />
            </div>
          </div>
          {(nameError || lockError) && (
            <div className="mt-2">
              {nameError && <ErrorMessage message={nameError} />}
              {lockError && <p className="text-xs text-[var(--state-danger-fg)]">{lockError}</p>}
            </div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 sm:mt-1 sm:gap-2.5">
            <JoinCodeBanner
              joinCode={session.joinCode}
              hideCodeByDefault
              onCopyResult={({ target, success }) => {
                if (success) {
                  pushNotice({
                    tone: "emerald",
                    message: target === "link" ? "Invite link copied." : "Invite code copied.",
                    durationMs: 2200,
                  });
                  return;
                }
                pushNotice({
                  tone: "amber",
                  message:
                    target === "link"
                      ? "Could not copy invite link."
                      : "Could not copy invite code.",
                  durationMs: 2600,
                });
              }}
            />
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="mt-1.5 flex flex-wrap items-center gap-2 md:justify-end sm:mt-2">
            <span className="group relative inline-flex">
              <Link
                href={`/sessions/${sessionId}/results`}
                className={`${resultsLinkClassName} peer shrink-0 whitespace-nowrap`}
              >
                <span className="sm:hidden">Results</span>
                <span className="hidden sm:inline">View Results</span>
              </Link>
              <ThemedTooltip className="max-w-[14rem]">Open ranking results</ThemedTooltip>
            </span>
            <CloseVoteButton
              sessionId={session.id}
              creatorId={session.creatorId}
              status={session.status}
              canManageOverride={session.canManageSession}
              className={`shrink-0 ${closeRankingButtonClassName}`}
              redirectHref={`/sessions/${sessionId}/results`}
            />
          </div>
        </div>
      </div>

      <TierListBoard
        key={sessionId}
        sessionId={sessionId}
        participantId={resolvedParticipantId}
        tierConfig={session.tierConfig}
        sessionItems={session.items}
        seededTiers={seededTiers}
        canEditTierConfig={canEditTierConfig}
        canSaveTemplate={!!currentUserId}
        canManageItems={session.canManageItems}
        templateIsHidden={session.templateIsHidden}
        onNotice={pushNotice}
        onSubmitted={() => router.push(`/sessions/${sessionId}/results`)}
      />
    </div>
  );
}
