"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { ItemPreview } from "@/components/ui/ItemPreview";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { Item, ListSummary } from "@/types";

const FEATURED_COUNT = 8;

interface SelectedListDetails {
  id: string;
  name: string;
  items: Item[];
}

export function NewVoteForm({
  spaceId = null,
  spaceName = null,
  initialLists = [],
  initialSelectedListId = null,
  initialSelectedListDetails = null,
  initialSelectedListUnavailable = false,
}: {
  spaceId?: string | null;
  spaceName?: string | null;
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
  const [nickname, setNickname] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const createInFlightRef = useRef(false);
  const listById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);

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
        backHref={spaceId ? `/spaces/${spaceId}` : null}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {spaceId ? (
        <Link href={`/spaces/${spaceId}`} className={`${buttonVariants.ghost} mb-3 inline-flex`}>
          &larr; Back to Space
        </Link>
      ) : null}
      <h1 className="mb-6 text-2xl font-bold">Start a Vote</h1>
      {spaceId && (
        <p className="-mt-4 mb-5 text-sm text-neutral-500">
          {`Publishing inside ${spaceName ?? "this space"} only.`}
        </p>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-300">Vote Name</span>
          <span className="mb-2 block text-xs text-neutral-500">
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
          <span className="mb-2 block text-sm font-medium text-neutral-300">Your Nickname</span>
          <span className="mb-2 block text-xs text-neutral-500">
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
              <p className="text-sm font-medium text-neutral-300">List Template</p>
              <p className="text-xs text-neutral-500">
                Pick the starting list for this vote. You can still edit it afterward.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="self-start text-sm text-amber-400 transition-colors hover:text-amber-300 sm:self-auto"
            >
              Change list
            </button>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
            <div className="min-w-0">
              {selectedListDetails ? (
                <>
                  <p className="truncate font-medium">{selectedListDetails.name}</p>
                  <p className="text-sm text-neutral-500">
                    {selectedListDetails.items.length} picks ready to use
                  </p>
                  {selectedListSummary?.origin ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-neutral-500">
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
                  <p className="text-sm text-neutral-500">Loading the full preview...</p>
                </>
              ) : selectedListUnavailable ? (
                <>
                  <p className="font-medium">That list is not available</p>
                  <p className="text-sm text-neutral-500">
                    Pick another list before you start the vote
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Start from scratch</p>
                  <p className="text-sm text-neutral-500">
                    You will add the picks after you start the vote
                  </p>
                </>
              )}
            </div>

            {selectedListDetails && selectedListDetails.items.length > 0 && (
              <div className="mt-4 border-t border-neutral-800 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
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

        {!spaceId && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800">
            <input
              type="checkbox"
              checked={!isPrivate}
              onChange={(e) => setIsPrivate(!e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <div>
              <p className="font-medium">Show in public Votes list</p>
              <p className="text-sm text-neutral-500">
                Off by default. People can still join private votes with the code.
              </p>
            </div>
          </label>
        )}

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
            onClick={() => (spaceId ? router.push(`/spaces/${spaceId}`) : router.back())}
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
}: {
  lists: ListSummary[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (id: string | null) => void;
  spaceMode: boolean;
  backHref: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const isSearching = query.trim().length > 0;
  const filtered = lists.filter((list) =>
    list.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const featured = lists.slice(0, FEATURED_COUNT);
  const canBrowseMore = lists.length > FEATURED_COUNT;
  const shouldShowList = isSearching || showAll;
  const groupedResults = groupListsForPicker(filtered, spaceMode);
  const shouldRenderGroupHeadings =
    groupedResults.filter((group) => group.items.length > 0).length > 1;

  return (
    <div className="mx-auto max-w-2xl">
      {backHref ? (
        <Link href={backHref} className={`${buttonVariants.ghost} mb-3 inline-flex`}>
          &larr; Back to Space
        </Link>
      ) : null}
      <h1 className="mb-6 text-2xl font-bold">Pick a list to start from</h1>

      <button
        type="button"
        onClick={() => onPick(null)}
        className="mb-6 flex w-full items-center gap-3 rounded-lg border border-dashed border-neutral-700 px-4 py-3 text-left transition-colors hover:border-neutral-500 hover:bg-neutral-900"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-400">
          +
        </div>
        <div className="min-w-0">
          <p className="font-medium text-neutral-200">Start blank</p>
          <p className="text-sm text-neutral-500">Add the picks after you start the vote</p>
        </div>
      </button>

      {lists.length > 0 && (
        <>
          {!isSearching && featured.length > 0 ? (
            <>
              <p className="mb-3 text-sm font-medium text-neutral-400">
                {spaceMode ? "Recommended lists" : "Popular lists"}
              </p>
              <div className="mb-5 space-y-3">
                {featured.map((list) => (
                  <ListPickerRow key={list.id} list={list} onSelect={() => onPick(list.id)} />
                ))}
              </div>
            </>
          ) : null}

          <Input
            type="text"
            placeholder="Search all lists..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoFocus
            className="w-full"
          />

          {!isSearching && canBrowseMore && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="mt-3 text-sm text-amber-400 transition-colors hover:text-amber-300"
            >
              {showAll ? "Show fewer" : "Show all lists"}
            </button>
          )}

          {shouldShowList && (
            <div className="mt-2 space-y-1">
              {filtered.length === 0 && (
                <p className="px-1 py-4 text-sm text-neutral-500">No lists match that search.</p>
              )}

              {groupedResults.map((group) => {
                if (group.items.length === 0) return null;
                return (
                  <div key={group.label} className="space-y-1">
                    {shouldRenderGroupHeadings ? (
                      <p className="px-1 pt-2 pb-1 text-xs font-medium text-neutral-500">
                        {group.label}
                      </p>
                    ) : null}
                    {group.items.map((list) => (
                      <ListPickerRow key={list.id} list={list} onSelect={() => onPick(list.id)} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ListPickerRow({ list, onSelect }: { list: ListSummary; onSelect: () => void }) {
  const listBadge =
    list.origin === "SPACE"
      ? "Space"
      : list.origin === "PERSONAL"
        ? "Yours"
        : list.isPublic
          ? "Public"
          : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left transition-colors hover:border-neutral-600"
    >
      <ItemPreview items={list.items} variant="stack" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-neutral-100">{list.name}</span>
        <span className="block text-sm text-neutral-500">{list._count.items} picks</span>
      </span>
      {listBadge ? (
        <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-400">
          {listBadge}
        </span>
      ) : null}
    </button>
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
    { label: "Your Lists", items: lists.filter((list) => !list.isPublic) },
    { label: "Public Lists", items: lists.filter((list) => list.isPublic) },
  ];
}
