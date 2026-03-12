"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

interface JoinErrorState {
  message: string;
  code: string | null;
  spaceName: string | null;
  spaceId: string | null;
}

interface JoinSessionContext {
  id: string;
  status: string;
  spaceId: string | null;
  spaceName: string | null;
  spaceVisibility: "OPEN" | "PRIVATE" | null;
}

interface JoinVotePageClientProps {
  initialSession?: JoinSessionContext | null;
  initialNickname?: string | null;
}

export function JoinVotePageClient({
  initialSession = null,
  initialNickname = null,
}: JoinVotePageClientProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";
  const inviteCodeFromUrl = (searchParams.get("spaceInvite") ?? "").trim().toUpperCase();

  const [joinCode, setJoinCode] = useState(codeFromUrl.toUpperCase());
  const [nickname, setNickname] = useState((initialNickname?.trim() ?? "").slice(0, 30));
  const [error, setError] = useState<JoinErrorState | null>(null);
  const [joining, setJoining] = useState(false);
  const [joiningSpace, setJoiningSpace] = useState(false);
  const [spaceJoinError, setSpaceJoinError] = useState("");

  const normalizedJoinCode = joinCode.trim().toUpperCase();
  const sessionIdFromContext = initialSession?.id ?? null;
  const isClosedPrivateInviteFlow =
    initialSession?.status !== "OPEN" &&
    initialSession?.spaceVisibility === "PRIVATE" &&
    !!inviteCodeFromUrl;
  const isPrivateSpaceMembershipError = error?.code === "SPACE_MEMBERSHIP_REQUIRED";
  const canJoinSpaceWithInvite =
    !!inviteCodeFromUrl && (isClosedPrivateInviteFlow || isPrivateSpaceMembershipError);
  const expectedSpaceId =
    error?.spaceId ?? (isClosedPrivateInviteFlow ? initialSession?.spaceId : null);
  const privateSpaceName = error?.spaceName ?? initialSession?.spaceName ?? null;
  const spacesJoinHref =
    canJoinSpaceWithInvite && inviteCodeFromUrl
      ? `/spaces?joinCode=${encodeURIComponent(inviteCodeFromUrl)}${
          expectedSpaceId ? `&expectedSpaceId=${encodeURIComponent(expectedSpaceId)}` : ""
        }`
      : "/spaces";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void join();
  };

  const join = async () => {
    if (joining) return;
    if (!normalizedJoinCode || !nickname.trim()) return;
    if (userLoading || !userId) {
      setError({
        message: "Getting your device ready. Try again in a second.",
        code: null,
        spaceName: null,
        spaceId: null,
      });
      return;
    }
    setJoining(true);
    setError(null);
    setSpaceJoinError("");

    try {
      const res = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinCode: normalizedJoinCode,
          nickname: nickname.trim(),
        }),
      });

      if (!res.ok) {
        let data: unknown = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        const payload =
          data && typeof data === "object"
            ? (data as { error?: unknown; code?: unknown; spaceName?: unknown; spaceId?: unknown })
            : {};

        setError({
          message: typeof payload.error === "string" ? payload.error : "Could not join this vote",
          code: typeof payload.code === "string" ? payload.code : null,
          spaceName: typeof payload.spaceName === "string" ? payload.spaceName : null,
          spaceId: typeof payload.spaceId === "string" ? payload.spaceId : null,
        });
        return;
      }

      const { sessionId, participantId, nickname: savedNickname } = await res.json();

      saveParticipant(sessionId, participantId, savedNickname);
      router.push(`/sessions/${sessionId}/vote`);
    } catch {
      setError({
        message: "Could not join this vote",
        code: null,
        spaceName: null,
        spaceId: null,
      });
    } finally {
      setJoining(false);
    }
  };

  const joinSpaceAndContinue = async () => {
    if (!canJoinSpaceWithInvite || joiningSpace || joining) return;
    if (userLoading || !userId) {
      setSpaceJoinError("Getting your device ready. Try again in a second.");
      return;
    }
    if (!isClosedPrivateInviteFlow && !nickname.trim()) {
      setSpaceJoinError("Enter your nickname first.");
      return;
    }

    setSpaceJoinError("");
    setJoiningSpace(true);
    try {
      const result = await apiPost<{ spaceId: string; joined: boolean }>("/api/spaces/join", {
        code: inviteCodeFromUrl,
        ...(expectedSpaceId ? { expectedSpaceId } : {}),
      });

      if (expectedSpaceId && result.spaceId !== expectedSpaceId) {
        setSpaceJoinError(
          "This invite does not match the space for this vote. Ask for the correct invite link.",
        );
        return;
      }

      if (isClosedPrivateInviteFlow && sessionIdFromContext && normalizedJoinCode) {
        router.push(
          `/sessions/${sessionIdFromContext}/results?code=${encodeURIComponent(normalizedJoinCode)}`,
        );
        return;
      }

      await join();
    } catch (joinError) {
      setSpaceJoinError(getErrorMessage(joinError, "Could not join this space"));
    } finally {
      setJoiningSpace(false);
    }
  };

  if (isClosedPrivateInviteFlow) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <Link href="/sessions" className={`${buttonVariants.ghost} mb-4 inline-flex items-center`}>
          &larr; Back to Votes
        </Link>
        <h1 className="mb-3 text-center text-2xl font-bold">View Vote Results</h1>
        <p className="mb-4 text-center text-sm text-[var(--fg-muted)]">
          This shared link points to a closed vote in a private space.
        </p>

        <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--fg-secondary)]">
          <p className="font-medium text-[var(--fg-primary)]">
            {privateSpaceName
              ? `Join "${privateSpaceName}" to continue.`
              : "Join this private space to continue."}
          </p>
          <p className="text-[var(--fg-muted)]">
            If you are not a member yet, ask the space owner for an invite.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void joinSpaceAndContinue()}
              className="!px-3 !py-1.5 !text-sm sm:!px-3 sm:!py-1.5 sm:!text-sm"
              disabled={joiningSpace || userLoading || !userId}
            >
              {joiningSpace ? "Joining space..." : "Join space and view results"}
            </Button>
            <Link
              href={spacesJoinHref}
              className={`${buttonVariants.secondary} !px-3 !py-1.5 !text-sm sm:!px-3 sm:!py-1.5 sm:!text-sm`}
            >
              Open spaces
            </Link>
          </div>
        </div>

        {(userError || spaceJoinError) && (
          <div className="mt-3 space-y-2">
            {userError ? <ErrorMessage message={userError} /> : null}
            {spaceJoinError ? <ErrorMessage message={spaceJoinError} /> : null}
            {userError ? (
              <Button variant="secondary" onClick={retryUser} className="w-full">
                Retry Device Setup
              </Button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-10">
      <Link href="/sessions" className={`${buttonVariants.ghost} mb-4 inline-flex items-center`}>
        &larr; Back to Votes
      </Link>
      <h1 className="mb-6 text-center text-2xl font-bold">Join a Vote</h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--fg-muted)]">Join Code</span>
          <Input
            type="text"
            placeholder="e.g., ABCD1234"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={20}
            className="w-full py-3 text-center text-xl font-mono tracking-widest"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--fg-muted)]">
            Your Nickname
          </span>
          <Input
            type="text"
            placeholder="e.g., Alex"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="w-full"
          />
        </label>

        {(userError || error || spaceJoinError) && (
          <div className="space-y-2">
            {userError && <ErrorMessage message={userError} />}
            {error && <ErrorMessage message={error.message} />}
            {isPrivateSpaceMembershipError && (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--fg-secondary)]">
                <p className="font-medium text-[var(--fg-primary)]">
                  {privateSpaceName
                    ? `This vote lives in "${privateSpaceName}", and that space is private.`
                    : "This vote lives in a private space."}
                </p>
                <p className="mt-1 text-[var(--fg-muted)]">
                  Join the space first, then continue to this vote.
                </p>
                <p className="mt-1 text-[var(--fg-subtle)]">
                  If you are not a member yet, ask the space owner for an invite.
                </p>
                {canJoinSpaceWithInvite ? (
                  <div className="mt-3 space-y-2">
                    <Button
                      variant="secondary"
                      onClick={() => void joinSpaceAndContinue()}
                      className="!px-3 !py-1.5 !text-sm sm:!px-3 sm:!py-1.5 sm:!text-sm"
                      disabled={
                        joiningSpace || joining || userLoading || !userId || !nickname.trim()
                      }
                    >
                      {joiningSpace
                        ? "Joining space..."
                        : joining
                          ? "Joining vote..."
                          : "Join space and continue"}
                    </Button>
                    {!nickname.trim() ? (
                      <p className="text-xs text-[var(--fg-subtle)]">
                        Enter your nickname first, then continue.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <Link
                  href={spacesJoinHref}
                  className={`${buttonVariants.secondary} mt-3 !px-3 !py-1.5 !text-sm sm:!px-3 sm:!py-1.5 sm:!text-sm`}
                >
                  Open spaces
                </Link>
              </div>
            )}
            {spaceJoinError ? <ErrorMessage message={spaceJoinError} /> : null}
            {userError && (
              <Button variant="secondary" onClick={retryUser} className="w-full">
                Retry Device Setup
              </Button>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={joining || userLoading || !normalizedJoinCode || !nickname.trim() || !userId}
          className="w-full py-3"
        >
          {joining ? "Joining..." : "Join Vote"}
        </Button>
      </form>
    </div>
  );
}
