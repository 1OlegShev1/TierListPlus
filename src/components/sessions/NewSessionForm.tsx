"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { Item, TemplateSummary } from "@/types";

const FEATURED_COUNT = 8;

interface SelectedTemplateDetails {
  id: string;
  name: string;
  items: Item[];
}

export function NewSessionForm() {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get("templateId");

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    preselectedTemplateId,
  );
  const [selectedTemplateDetails, setSelectedTemplateDetails] =
    useState<SelectedTemplateDetails | null>(null);
  const [selectedTemplateFetchStatus, setSelectedTemplateFetchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [step, setStep] = useState<"pick" | "details">(preselectedTemplateId ? "details" : "pick");
  const [templateQuery, setTemplateQuery] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<TemplateSummary[]>(`/api/templates?previewLimit=${FEATURED_COUNT}`)
      .then(setTemplates)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplateDetails(null);
      setSelectedTemplateFetchStatus("idle");
      return;
    }

    let isCurrent = true;
    setSelectedTemplateDetails(null);
    setSelectedTemplateFetchStatus("loading");

    apiFetch<SelectedTemplateDetails>(`/api/templates/${selectedTemplateId}`)
      .then((data) => {
        if (!isCurrent) return;
        setSelectedTemplateDetails(data);
        setSelectedTemplateFetchStatus("ready");
      })
      .catch(() => {
        if (!isCurrent) return;
        setSelectedTemplateFetchStatus("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedTemplateId]);

  const selectedTemplateSummary = selectedTemplateId
    ? (templates.find((t) => t.id === selectedTemplateId) ?? null)
    : null;
  const selectedTemplateLoading = !!selectedTemplateId && selectedTemplateFetchStatus === "loading";
  const selectedTemplateUnavailable =
    !!selectedTemplateId && selectedTemplateFetchStatus === "error";

  const pickTemplate = (id: string | null) => {
    setSelectedTemplateId(id);
    setStep("details");
  };

  const canCreate =
    !!name.trim() &&
    !!nickname.trim() &&
    !creating &&
    !userLoading &&
    !!userId &&
    !selectedTemplateLoading &&
    !selectedTemplateUnavailable;

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError("");
    try {
      const data = await apiPost<{
        id: string;
        participantId: string;
        participantNickname: string;
      }>("/api/sessions", {
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
        name,
        nickname: nickname.trim(),
        isPrivate,
      });

      saveParticipant(data.id, data.participantId, data.participantNickname);
      router.push(`/sessions/${data.id}/vote`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create session"));
    } finally {
      setCreating(false);
    }
  };

  if (step === "pick") {
    return (
      <TemplatePicker
        templates={templates}
        query={templateQuery}
        onQueryChange={setTemplateQuery}
        onPick={pickTemplate}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Start a Session</h1>

      <div className="space-y-6">
        <div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {selectedTemplateDetails ? (
                  <>
                    <p className="truncate font-medium">{selectedTemplateDetails.name}</p>
                    <p className="text-sm text-neutral-500">
                      {selectedTemplateDetails.items.length} items — you can edit them after
                      creating
                    </p>
                  </>
                ) : selectedTemplateLoading ? (
                  <>
                    <p className="truncate font-medium">
                      {selectedTemplateSummary?.name ?? "Loading selected template..."}
                    </p>
                    <p className="text-sm text-neutral-500">Loading full item preview...</p>
                  </>
                ) : selectedTemplateUnavailable ? (
                  <>
                    <p className="font-medium">Selected template unavailable</p>
                    <p className="text-sm text-neutral-500">
                      Choose another starting point before creating the session
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Blank session</p>
                    <p className="text-sm text-neutral-500">
                      You'll add items after creating the session
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="shrink-0 text-sm text-amber-400 transition-colors hover:text-amber-300"
              >
                Change
              </button>
            </div>

            {selectedTemplateDetails && selectedTemplateDetails.items.length > 0 && (
              <div className="mt-4 border-t border-neutral-800 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Template Items
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {selectedTemplateDetails.items.map((item) => (
                    <img
                      key={item.id}
                      src={item.imageUrl}
                      alt={item.label}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-400">Session Name</span>
          <Input
            type="text"
            placeholder="e.g., Friday Rankings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-400">Your Nickname</span>
          <Input
            type="text"
            placeholder="e.g., Alex"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="w-full"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800">
          <input
            type="checkbox"
            checked={!isPrivate}
            onChange={(e) => setIsPrivate(!e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          <div>
            <p className="font-medium">Show in public Sessions list</p>
            <p className="text-sm text-neutral-500">
              Disabled by default. People can still join private sessions by join code.
            </p>
          </div>
        </label>

        {(userError || error) && (
          <div className="space-y-2">
            {userError && <ErrorMessage message={userError} />}
            {error && <ErrorMessage message={error} />}
            {userError && (
              <Button variant="secondary" onClick={retryUser}>
                Retry Identity Setup
              </Button>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={create} disabled={!canCreate}>
            {creating ? "Creating..." : "Create Session"}
          </Button>
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplatePicker({
  templates,
  query,
  onQueryChange,
  onPick,
}: {
  templates: TemplateSummary[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (id: string | null) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const isSearching = query.trim().length > 0;
  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const featured = templates.slice(0, FEATURED_COUNT);
  const canBrowseMore = templates.length > FEATURED_COUNT;
  const shouldShowList = isSearching || showAll;

  // For the search results list, group by private/public
  const privateResults = filtered.filter((t) => !t.isPublic);
  const publicResults = filtered.filter((t) => t.isPublic);
  const hasGroups = privateResults.length > 0 && publicResults.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Choose a starting point</h1>

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
          <p className="text-sm text-neutral-500">Add items after creating the session</p>
        </div>
      </button>

      {templates.length > 0 && (
        <>
          {!isSearching && featured.length > 0 && (
            <>
              <p className="mb-3 text-sm font-medium text-neutral-400">Top templates</p>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {featured.map((t) => (
                  <TemplateCard key={t.id} template={t} onSelect={() => onPick(t.id)} />
                ))}
              </div>
            </>
          )}

          <Input
            type="text"
            placeholder="Search all templates..."
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
              {showAll ? "Show fewer" : "Show all templates"}
            </button>
          )}

          {shouldShowList && (
            <div className="mt-2 space-y-1">
              {filtered.length === 0 && (
                <p className="px-1 py-4 text-sm text-neutral-500">
                  No templates match that search.
                </p>
              )}

              {hasGroups && privateResults.length > 0 && (
                <p className="px-1 pt-1 pb-1 text-xs font-medium text-neutral-500">
                  Your Templates
                </p>
              )}
              {privateResults.map((t) => (
                <TemplateRow key={t.id} template={t} onSelect={() => onPick(t.id)} />
              ))}

              {hasGroups && publicResults.length > 0 && (
                <p className="px-1 pt-3 pb-1 text-xs font-medium text-neutral-500">
                  Public Templates
                </p>
              )}
              {publicResults.map((t) => (
                <TemplateRow key={t.id} template={t} onSelect={() => onPick(t.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TemplateCard({ template, onSelect }: { template: TemplateSummary; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-left transition-colors hover:border-neutral-600"
    >
      <div className="mb-2 grid grid-cols-2 gap-1">
        {template.items.map((item) => (
          <img
            key={item.id}
            src={item.imageUrl}
            alt=""
            className="aspect-square w-full rounded object-cover"
          />
        ))}
        {Array.from({ length: Math.max(0, 4 - template.items.length) }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static empty placeholders never reorder
          <div key={i} className="aspect-square w-full rounded bg-neutral-800" />
        ))}
      </div>
      <p className="truncate text-sm font-medium">{template.name}</p>
      <p className="text-xs text-neutral-500">{template._count.items} items</p>
    </button>
  );
}

function TemplateRow({ template, onSelect }: { template: TemplateSummary; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-900"
    >
      <span className="min-w-0 truncate font-medium">{template.name}</span>
      <span className="ml-3 shrink-0 text-xs text-neutral-500">{template._count.items} items</span>
    </button>
  );
}
