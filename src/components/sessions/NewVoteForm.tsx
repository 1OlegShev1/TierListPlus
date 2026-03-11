"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import type { ListDisplayChip } from "@/lib/list-display";
import type { ListSummary } from "@/types";

const QUICK_START_LIST_COUNT = 2;
const BLANK_SELECTION_KEY = "__blank__";
const BLANK_VOTE_NAME = "Blank Canvas Vote";

function buildDefaultVoteName(listName: string | null): string {
  const trimmed = listName?.trim() ?? "";
  if (!trimmed) return BLANK_VOTE_NAME;
  if (/\bvote\b/i.test(trimmed)) return trimmed.slice(0, 100);
  return `${trimmed} Vote`.slice(0, 100);
}

export function NewVoteForm({
  spaceId = null,
  initialNickname = null,
  initialLists = [],
}: {
  spaceId?: string | null;
  initialNickname?: string | null;
  initialLists?: ListSummary[];
}) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const [lists] = useState<ListSummary[]>(initialLists);
  const [listQuery, setListQuery] = useState("");
  const [creatingSelectionKey, setCreatingSelectionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createInFlightRef = useRef(false);
  const backHref = spaceId ? `/spaces/${spaceId}#votes` : "/sessions";
  const backLabel = spaceId ? "Back to Space Votes" : "Back to Votes";
  const defaultNickname = (initialNickname?.trim() || "Host").slice(0, 30);
  const canCreate = !creatingSelectionKey && !userLoading && !!userId;

  const createVote = async (list: ListSummary | null) => {
    if (!canCreate || createInFlightRef.current) return;
    createInFlightRef.current = true;
    const selectionKey = list?.id ?? BLANK_SELECTION_KEY;
    setCreatingSelectionKey(selectionKey);
    setError(null);
    try {
      const data = await apiPost<{
        id: string;
        participantId: string;
        participantNickname: string;
      }>(spaceId ? `/api/spaces/${spaceId}/sessions` : "/api/sessions", {
        ...(list ? { templateId: list.id } : {}),
        name: buildDefaultVoteName(list?.name ?? null),
        nickname: defaultNickname,
        ...(spaceId ? {} : { isPrivate: true }),
      });

      saveParticipant(data.id, data.participantId, data.participantNickname);
      router.push(`/sessions/${data.id}/vote?editName=1`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not start this vote"));
    } finally {
      createInFlightRef.current = false;
      setCreatingSelectionKey(null);
    }
  };

  return (
    <ListPicker
      lists={lists}
      query={listQuery}
      onQueryChange={setListQuery}
      onPick={(list) => {
        void createVote(list);
      }}
      spaceMode={!!spaceId}
      backHref={backHref}
      backLabel={backLabel}
      canPick={canCreate}
      creatingSelectionKey={creatingSelectionKey}
      userError={userError}
      error={error}
      onRetryUser={retryUser}
    />
  );
}

function ListPicker({
  lists,
  query,
  onQueryChange,
  onPick,
  spaceMode,
  backHref,
  backLabel,
  canPick,
  creatingSelectionKey,
  userError,
  error,
  onRetryUser,
}: {
  lists: ListSummary[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (list: ListSummary | null) => void;
  spaceMode: boolean;
  backHref: string;
  backLabel: string;
  canPick: boolean;
  creatingSelectionKey: string | null;
  userError: string | null;
  error: string | null;
  onRetryUser: () => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const filteredLists = lists.filter((list) => list.name.toLowerCase().includes(normalizedQuery));
  const quickStartLists = lists.slice(0, QUICK_START_LIST_COUNT);
  const quickStartListIds = new Set(quickStartLists.map((list) => list.id));
  const browseableLists = lists.filter((list) => !quickStartListIds.has(list.id));
  const browseSections = groupListsForPicker(browseableLists, spaceMode).filter(
    (group) => group.items.length > 0,
  );
  const searchSections = groupListsForPicker(filteredLists, spaceMode).filter(
    (group) => group.items.length > 0,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={backHref} className={`${buttonVariants.ghost} mb-3 inline-flex items-center`}>
        {`← ${backLabel}`}
      </Link>

      {(userError || error) && (
        <div className="mb-4 space-y-2">
          {userError && <ErrorMessage message={userError} />}
          {error && <ErrorMessage message={error} />}
          {userError && (
            <Button variant="secondary" onClick={onRetryUser}>
              Retry Device Setup
            </Button>
          )}
        </div>
      )}

      <div className="space-y-10">
        <section>
          <SectionHeader
            title="Choose How to Start"
            subtitle="Pick a list to create the vote instantly."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BlankStartCard
              onSelect={() => onPick(null)}
              disabled={!canPick}
              isStarting={creatingSelectionKey === BLANK_SELECTION_KEY}
            />
            {quickStartLists.map((list) => (
              <ListPickerCard
                key={list.id}
                list={list}
                onSelect={() => onPick(list)}
                disabled={!canPick}
                isStarting={creatingSelectionKey === list.id}
              />
            ))}
          </div>
        </section>

        {lists.length > 0 ? (
          <>
            <section>
              <SectionHeader
                title="Browse Lists"
                subtitle="Search across your lists, space lists, and public lists."
              />
              <Input
                type="text"
                placeholder="Search lists..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                autoFocus
                className="w-full"
              />
            </section>

            {isSearching ? (
              <section>
                <SectionHeader
                  title="Search Results"
                  subtitle={
                    searchSections.length > 0
                      ? "Pick a list to use as the starting point."
                      : "No lists match that search yet."
                  }
                />
                {searchSections.length > 0 ? (
                  <div className="space-y-8">
                    {searchSections.map((group) => (
                      <PickerSection
                        key={group.label}
                        title={group.label}
                        lists={group.items}
                        onPick={onPick}
                        canPick={canPick}
                        creatingSelectionKey={creatingSelectionKey}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : (
              <div className="space-y-10">
                {browseSections.map((group) => (
                  <PickerSection
                    key={group.label}
                    title={group.label}
                    lists={group.items}
                    onPick={onPick}
                    canPick={canPick}
                    creatingSelectionKey={creatingSelectionKey}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function PickerSection({
  title,
  lists,
  onPick,
  canPick,
  creatingSelectionKey,
}: {
  title: string;
  lists: ListSummary[];
  onPick: (list: ListSummary | null) => void;
  canPick: boolean;
  creatingSelectionKey: string | null;
}) {
  return (
    <section>
      <SectionHeader title={title} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => (
          <ListPickerCard
            key={list.id}
            list={list}
            onSelect={() => onPick(list)}
            disabled={!canPick}
            isStarting={creatingSelectionKey === list.id}
          />
        ))}
      </div>
    </section>
  );
}

function groupListsForPicker(lists: ListSummary[], spaceMode: boolean) {
  if (spaceMode) {
    return [
      {
        label: "Space Lists",
        items: lists.filter((list) => list.origin === "SPACE"),
      },
      {
        label: "Your Lists",
        items: lists.filter((list) => list.origin === "PERSONAL"),
      },
      {
        label: "Public Lists",
        items: lists.filter((list) => list.origin === "PUBLIC"),
      },
    ];
  }

  return [
    {
      label: "Your Lists",
      items: lists.filter((list) => resolveListOrigin(list) === "PERSONAL"),
    },
    {
      label: "Public Lists",
      items: lists.filter((list) => resolveListOrigin(list) === "PUBLIC"),
    },
  ];
}

function BlankStartCard({
  onSelect,
  disabled,
  isStarting,
}: {
  onSelect: () => void;
  disabled: boolean;
  isStarting: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-busy={isStarting || undefined}
      className={`block h-full w-full text-left ${disabled ? "cursor-not-allowed opacity-75" : ""}`}
    >
      <ListPreviewCard
        title="Start blank"
        detailsLabel={isStarting ? "Starting vote..." : "Add the picks after the vote starts."}
        secondaryLabel="No preset items"
        items={[]}
        chips={[{ label: isStarting ? "Starting..." : "Quick start", tone: "accent" }]}
        className={`h-full border-dashed transition-colors ${
          disabled ? "" : "hover:border-[var(--border-strong)]"
        }`}
      />
    </button>
  );
}

function ListPickerCard({
  list,
  onSelect,
  disabled,
  isStarting,
}: {
  list: ListSummary;
  onSelect: () => void;
  disabled: boolean;
  isStarting: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-busy={isStarting || undefined}
      className={`block h-full w-full text-left ${disabled ? "cursor-not-allowed opacity-75" : ""}`}
    >
      <ListPreviewCard
        title={list.name}
        detailsLabel={isStarting ? "Starting vote..." : `${list._count.items} picks`}
        secondaryLabel="Ready to use in this vote"
        items={list.items}
        chips={buildPickerChips(list)}
        className={`h-full transition-colors ${disabled ? "" : "hover:border-[var(--border-strong)]"}`}
      />
    </button>
  );
}

function buildPickerChips(list: ListSummary): ListDisplayChip[] {
  const origin = resolveListOrigin(list);
  const originChip: ListDisplayChip =
    origin === "SPACE"
      ? { label: "Space list", tone: "neutral" }
      : origin === "PERSONAL"
        ? { label: "Your list", tone: "accent" }
        : { label: "Public list", tone: "public" };

  if (origin === "SPACE") {
    return [originChip];
  }

  return [
    originChip,
    {
      label: list.isPublic ? "Public" : "Private",
      tone: list.isPublic ? "public" : "private",
    },
  ];
}

function resolveListOrigin(list: ListSummary): "SPACE" | "PERSONAL" | "PUBLIC" {
  if (list.origin) return list.origin;
  return list.isPublic ? "PUBLIC" : "PERSONAL";
}
