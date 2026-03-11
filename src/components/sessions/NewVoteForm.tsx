"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { VoteVisibilityField } from "@/components/sessions/VoteVisibilityField";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { ListDisplayChip } from "@/lib/list-display";
import type { Item, ListSummary } from "@/types";

const QUICK_START_LIST_COUNT = 2;

interface SelectedListDetails {
  id: string;
  name: string;
  items: Item[];
}

export function NewVoteForm({
  spaceId = null,
  spaceName = null,
  initialNickname = null,
  initialLists = [],
  initialSelectedListId = null,
  initialSelectedListDetails = null,
  initialSelectedListUnavailable = false,
}: {
  spaceId?: string | null;
  spaceName?: string | null;
  initialNickname?: string | null;
  initialLists?: ListSummary[];
  initialSelectedListId?: string | null;
  initialSelectedListDetails?: SelectedListDetails | null;
  initialSelectedListUnavailable?: boolean;
}) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const [lists] = useState<ListSummary[]>(initialLists);
  const [selectedListId, setSelectedListId] = useState<string | null>(initialSelectedListId);
  const [selectedListDetails, setSelectedListDetails] = useState<SelectedListDetails | null>(
    initialSelectedListDetails,
  );
  const [selectedListFetchStatus, setSelectedListFetchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(() => {
    if (!initialSelectedListId) return "idle";
    if (initialSelectedListDetails) return "ready";
    if (initialSelectedListUnavailable) return "error";
    return "loading";
  });
  const [step, setStep] = useState<"pick" | "details">(initialSelectedListId ? "details" : "pick");
  const [listQuery, setListQuery] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const createInFlightRef = useRef(false);
  const listById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
  const backHref = spaceId ? `/spaces/${spaceId}#votes` : "/sessions";
  const backLabel = spaceId ? "Back to Space Votes" : "Back to Votes";

  useEffect(() => {
    if (!selectedListId) {
      setSelectedListDetails(null);
      setSelectedListFetchStatus("idle");
      return;
    }

    if (
      selectedListId === initialSelectedListId &&
      (initialSelectedListDetails || initialSelectedListUnavailable)
    ) {
      setSelectedListDetails(initialSelectedListDetails);
      setSelectedListFetchStatus(initialSelectedListDetails ? "ready" : "error");
      return;
    }

    let isCurrent = true;
    setSelectedListDetails(null);
    setSelectedListFetchStatus("loading");
    const selectedListSummary = listById.get(selectedListId) ?? null;
    const selectedTemplateEndpoint =
      spaceId && selectedListSummary?.origin === "SPACE"
        ? `/api/spaces/${spaceId}/templates/${selectedListId}`
        : `/api/templates/${selectedListId}`;

    apiFetch<SelectedListDetails>(selectedTemplateEndpoint)
      .then((data) => {
        if (!isCurrent) return;
        setSelectedListDetails(data);
        setSelectedListFetchStatus("ready");
      })
      .catch(() => {
        if (!isCurrent) return;
        setSelectedListFetchStatus("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [
    initialSelectedListDetails,
    initialSelectedListId,
    initialSelectedListUnavailable,
    listById,
    spaceId,
    selectedListId,
  ]);

  const selectedListSummary = selectedListId ? (listById.get(selectedListId) ?? null) : null;
  const selectedListLoading = !!selectedListId && selectedListFetchStatus === "loading";
  const selectedListUnavailable = !!selectedListId && selectedListFetchStatus === "error";

  const pickList = (id: string | null) => {
    setSelectedListId(id);
    setStep("details");
  };

  const trimmedName = name.trim();
  const trimmedNickname = nickname.trim();
  const canCreate =
    !!trimmedName &&
    !!trimmedNickname &&
    !creating &&
    !userLoading &&
    !!userId &&
    !selectedListLoading &&
    !selectedListUnavailable;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void create();
  };

  const create = async () => {
    if (!canCreate || createInFlightRef.current) return;
    createInFlightRef.current = true;
    setCreating(true);
    setError("");
    try {
      const data = await apiPost<{
        id: string;
        participantId: string;
        participantNickname: string;
      }>(spaceId ? `/api/spaces/${spaceId}/sessions` : "/api/sessions", {
        ...(selectedListId ? { templateId: selectedListId } : {}),
        name: trimmedName,
        nickname: trimmedNickname,
        ...(spaceId ? {} : { isPrivate }),
      });

      saveParticipant(data.id, data.participantId, data.participantNickname);
      router.push(`/sessions/${data.id}/vote`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not start this vote"));
    } finally {
      createInFlightRef.current = false;
      setCreating(false);
    }
  };

  if (step === "pick") {
    return (
      <ListPicker
        lists={lists}
        query={listQuery}
        onQueryChange={setListQuery}
        onPick={pickList}
        spaceMode={!!spaceId}
        backHref={backHref}
        backLabel={backLabel}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={backHref} className={`${buttonVariants.ghost} mb-3 inline-flex items-center`}>
        {`← ${backLabel}`}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Start a Vote</h1>
      {spaceId && (
        <p className="-mt-4 mb-5 text-sm text-[var(--fg-subtle)]">
          {`Publishing inside ${spaceName ?? "this space"} only.`}
        </p>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
            Vote Name
          </span>
          <span className="mb-2 block text-xs text-[var(--fg-subtle)]">
            This is the title people will see when they join.
          </span>
          <Input
            type="text"
            placeholder="e.g., Best Burgers in Town"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
            Your Nickname
          </span>
          <span className="mb-2 block text-xs text-[var(--fg-subtle)]">
            You will join this vote with this display name.
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

        <div>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--fg-secondary)]">List Template</p>
              <p className="text-xs text-[var(--fg-subtle)]">
                Pick the starting list for this vote. You can still edit it afterward.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="self-start text-sm text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary-hover)] sm:self-auto"
            >
              Change list
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="min-w-0">
              {selectedListDetails ? (
                <>
                  <p className="truncate font-medium">{selectedListDetails.name}</p>
                  <p className="text-sm text-[var(--fg-subtle)]">
                    {selectedListDetails.items.length} picks ready to use
                  </p>
                  {selectedListSummary?.origin ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                      {selectedListSummary.origin === "SPACE"
                        ? "Space list"
                        : selectedListSummary.origin === "PERSONAL"
                          ? "Your list"
                          : "Public list"}
                    </p>
                  ) : null}
                </>
              ) : selectedListLoading ? (
                <>
                  <p className="truncate font-medium">
                    {selectedListSummary?.name ?? "Loading this list..."}
                  </p>
                  <p className="text-sm text-[var(--fg-subtle)]">Loading the full preview...</p>
                </>
              ) : selectedListUnavailable ? (
                <>
                  <p className="font-medium">That list is not available</p>
                  <p className="text-sm text-[var(--fg-subtle)]">
                    Pick another list before you start the vote
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Start from scratch</p>
                  <p className="text-sm text-[var(--fg-subtle)]">
                    You will add the picks after you start the vote
                  </p>
                </>
              )}
            </div>

            {selectedListDetails && selectedListDetails.items.length > 0 && (
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
                  Preview
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {selectedListDetails.items.map((item) => (
                    <ItemArtwork
                      key={item.id}
                      src={item.imageUrl}
                      alt={item.label}
                      className="aspect-square w-full rounded-md"
                      presentation="ambient"
                      inset="compact"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <VoteVisibilityField
          isPrivate={isPrivate}
          onChange={setIsPrivate}
          disabled={!!spaceId}
          helperText={
            spaceId
              ? "Visibility for space votes is managed in Space Settings."
              : "Off by default. People can still join private votes with the code."
          }
          extraNote={
            spaceId ? undefined : "Share only content you are allowed to publish and distribute."
          }
        />

        {(userError || error) && (
          <div className="space-y-2">
            {userError && <ErrorMessage message={userError} />}
            {error && <ErrorMessage message={error} />}
            {userError && (
              <Button variant="secondary" onClick={retryUser}>
                Retry Device Setup
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={!canCreate} className="w-full sm:w-auto">
            {creating ? "Starting..." : "Start Vote"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push(backHref)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
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
}: {
  lists: ListSummary[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (id: string | null) => void;
  spaceMode: boolean;
  backHref: string;
  backLabel: string;
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
      <PageHeader
        title="Start a Vote"
        subtitle="Pick a starting point for this vote. You can still change the list later."
      />

      <div className="space-y-10">
        <section>
          <SectionHeader
            title="Choose How to Start"
            subtitle="Begin blank or jump in from a suggested list."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <BlankStartCard onSelect={() => onPick(null)} />
            {quickStartLists.map((list) => (
              <ListPickerCard key={list.id} list={list} onSelect={() => onPick(list.id)} />
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
}: {
  title: string;
  lists: ListSummary[];
  onPick: (id: string | null) => void;
}) {
  return (
    <section>
      <SectionHeader title={title} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => (
          <ListPickerCard key={list.id} list={list} onSelect={() => onPick(list.id)} />
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

function BlankStartCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="block h-full w-full text-left">
      <ListPreviewCard
        title="Start blank"
        detailsLabel="Add the picks after the vote starts."
        secondaryLabel="No preset items"
        items={[]}
        chips={[{ label: "Quick start", tone: "accent" }]}
        className="h-full border-dashed transition-colors hover:border-[var(--border-strong)]"
      />
    </button>
  );
}

function ListPickerCard({ list, onSelect }: { list: ListSummary; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="block h-full w-full text-left">
      <ListPreviewCard
        title={list.name}
        detailsLabel={`${list._count.items} picks`}
        secondaryLabel="Ready to use in this vote"
        items={list.items}
        chips={buildPickerChips(list)}
        className="h-full transition-colors hover:border-[var(--border-strong)]"
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
