import type { DraftKind } from "@prisma/client";
import {
  MAX_SOURCE_INTERVAL_SECONDS,
  normalizeItemLabel,
  parseAnyItemSource,
} from "@/lib/item-source";
import type { TemplateItemData } from "@/types";

const STORAGE_KEY_PREFIX = "tierlistplus_list_draft_v1";
const LIST_EDITOR_DRAFT_VERSION = 1 as const;
const LIST_EDITOR_DRAFT_KIND: DraftKind = "LIST_EDITOR";
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_SOURCE_NOTE_LENGTH = 120;
const DEFAULT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ListEditorDraftItem {
  id?: string;
  label: string;
  imageUrl: string;
  sourceUrl?: string | null;
  sourceProvider?: "SPOTIFY" | "YOUTUBE" | null;
  sourceNote?: string | null;
  sourceStartSec?: number | null;
  sourceEndSec?: number | null;
  sortOrder: number;
}

export interface ListEditorDraftSnapshot {
  version: typeof LIST_EDITOR_DRAFT_VERSION;
  updatedAtMs: number;
  name: string;
  description: string;
  isPublic: boolean;
  items: ListEditorDraftItem[];
}

export interface ListDraftContext {
  userId: string;
  scopeId: string;
}

export interface ListDraftStore {
  load(
    context: ListDraftContext,
  ): Promise<ListEditorDraftSnapshot | null> | ListEditorDraftSnapshot | null;
  save(context: ListDraftContext, snapshot: ListEditorDraftSnapshot): Promise<void> | void;
  clear(context: ListDraftContext): Promise<void> | void;
}

interface ScopeInput {
  listId?: string;
  spaceId?: string | null;
}

interface SnapshotInput {
  updatedAtMs?: number;
  name: string;
  description: string;
  isPublic: boolean;
  items: TemplateItemData[];
}

interface RemoteDraftResponse {
  kind: DraftKind;
  scope: string;
  payload: unknown;
  updatedAtMs: number;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function coerceTrimmedString(value: unknown): string | null {
  const str = coerceString(value);
  if (str === null) return null;
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeName(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  return raw.slice(0, MAX_NAME_LENGTH);
}

function normalizeDescription(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  return raw.slice(0, MAX_DESCRIPTION_LENGTH);
}

function normalizeSourceNote(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_SOURCE_NOTE_LENGTH);
}

function normalizeTime(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > MAX_SOURCE_INTERVAL_SECONDS) return null;
  return Math.floor(value);
}

function normalizeSourceProvider(value: unknown): "SPOTIFY" | "YOUTUBE" | null {
  if (value === "SPOTIFY" || value === "YOUTUBE") return value;
  return null;
}

function normalizeItem(item: unknown, fallbackSortOrder: number): ListEditorDraftItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  const normalizedSourceUrl = (() => {
    const sourceUrlRaw = coerceTrimmedString(record.sourceUrl);
    if (!sourceUrlRaw) return null;
    const parsed = parseAnyItemSource(sourceUrlRaw);
    return parsed?.normalizedUrl ?? null;
  })();

  const rawImageUrl = coerceTrimmedString(record.imageUrl);
  if (!rawImageUrl) return null;

  const sortOrderRaw = record.sortOrder;
  const sortOrder =
    typeof sortOrderRaw === "number" && Number.isFinite(sortOrderRaw) && sortOrderRaw >= 0
      ? Math.floor(sortOrderRaw)
      : fallbackSortOrder;

  const normalizedSourceStartSec = normalizeTime(record.sourceStartSec);
  const normalizedSourceEndSec = normalizeTime(record.sourceEndSec);
  const normalizedLabel = normalizeItemLabel(coerceString(record.label) ?? "");
  const normalizedId = coerceTrimmedString(record.id);
  const sourceProviderFromUrl = normalizedSourceUrl
    ? (parseAnyItemSource(normalizedSourceUrl)?.provider ?? null)
    : null;
  const sourceProvider = sourceProviderFromUrl ?? normalizeSourceProvider(record.sourceProvider);
  const sourceNote = normalizeSourceNote(record.sourceNote);

  return {
    ...(normalizedId ? { id: normalizedId } : {}),
    label: normalizedLabel,
    imageUrl: rawImageUrl,
    sourceUrl: normalizedSourceUrl,
    sourceProvider,
    sourceNote,
    sourceStartSec: normalizedSourceStartSec,
    sourceEndSec: normalizedSourceEndSec,
    sortOrder,
  };
}

function normalizeItems(items: unknown): ListEditorDraftItem[] {
  if (!Array.isArray(items)) return [];
  const normalized = items
    .map((item, index) => normalizeItem(item, index))
    .filter((item): item is ListEditorDraftItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index,
    }));
  return normalized;
}

function isValidUpdatedAtMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeSnapshot(value: unknown): ListEditorDraftSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== LIST_EDITOR_DRAFT_VERSION) return null;
  if (!isValidUpdatedAtMs(record.updatedAtMs)) return null;

  return {
    version: LIST_EDITOR_DRAFT_VERSION,
    updatedAtMs: record.updatedAtMs,
    name: normalizeName(record.name),
    description: normalizeDescription(record.description),
    isPublic: record.isPublic === true,
    items: normalizeItems(record.items),
  };
}

export function buildListEditorScopeId({ listId, spaceId }: ScopeInput): string {
  if (listId) {
    return `list-editor:edit:${listId}`;
  }
  if (spaceId) {
    return `list-editor:create:space:${spaceId}`;
  }
  return "list-editor:create:personal";
}

export function createListEditorDraftSnapshot(input: SnapshotInput): ListEditorDraftSnapshot {
  const snapshot: ListEditorDraftSnapshot = {
    version: LIST_EDITOR_DRAFT_VERSION,
    updatedAtMs: isValidUpdatedAtMs(input.updatedAtMs) ? input.updatedAtMs : Date.now(),
    name: normalizeName(input.name),
    description: normalizeDescription(input.description),
    isPublic: input.isPublic,
    items: normalizeItems(input.items),
  };
  return snapshot;
}

export function areListEditorDraftsEquivalent(
  left: ListEditorDraftSnapshot,
  right: ListEditorDraftSnapshot,
): boolean {
  if (left.name !== right.name) return false;
  if (left.description !== right.description) return false;
  if (left.isPublic !== right.isPublic) return false;
  if (left.items.length !== right.items.length) return false;

  for (let index = 0; index < left.items.length; index += 1) {
    const a = left.items[index];
    const b = right.items[index];
    if (!a || !b) return false;
    if ((a.id ?? null) !== (b.id ?? null)) return false;
    if (a.label !== b.label) return false;
    if (a.imageUrl !== b.imageUrl) return false;
    if ((a.sourceUrl ?? null) !== (b.sourceUrl ?? null)) return false;
    if ((a.sourceProvider ?? null) !== (b.sourceProvider ?? null)) return false;
    if ((a.sourceNote ?? null) !== (b.sourceNote ?? null)) return false;
    if ((a.sourceStartSec ?? null) !== (b.sourceStartSec ?? null)) return false;
    if ((a.sourceEndSec ?? null) !== (b.sourceEndSec ?? null)) return false;
  }

  return true;
}

export function getListDraftStorageKey(context: ListDraftContext): string {
  return `${STORAGE_KEY_PREFIX}:${context.userId}:${context.scopeId}`;
}

export class LocalListDraftStore implements ListDraftStore {
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options?: { now?: () => number; ttlMs?: number }) {
    this.now = options?.now ?? (() => Date.now());
    this.ttlMs = options?.ttlMs ?? DEFAULT_DRAFT_TTL_MS;
  }

  load(context: ListDraftContext): ListEditorDraftSnapshot | null {
    if (typeof window === "undefined") return null;

    try {
      const key = getListDraftStorageKey(context);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        localStorage.removeItem(key);
        return null;
      }

      const parsed = normalizeSnapshot(parsedJson);
      if (!parsed) {
        localStorage.removeItem(key);
        return null;
      }

      if (this.now() - parsed.updatedAtMs > this.ttlMs) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  save(context: ListDraftContext, snapshot: ListEditorDraftSnapshot): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getListDraftStorageKey(context), JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures to keep editing unblocked.
    }
  }

  clear(context: ListDraftContext): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(getListDraftStorageKey(context));
    } catch {
      // Ignore storage failures to keep editing unblocked.
    }
  }
}

export class RemoteListDraftStore implements ListDraftStore {
  async load(context: ListDraftContext): Promise<ListEditorDraftSnapshot | null> {
    const query = new URLSearchParams({
      kind: LIST_EDITOR_DRAFT_KIND,
      scope: context.scopeId,
    });
    const res = await fetch(`/api/drafts?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Remote draft load failed (${res.status})`);
    }
    const payload = (await res.json()) as RemoteDraftResponse;
    if (payload.kind !== LIST_EDITOR_DRAFT_KIND) return null;
    const snapshot = normalizeSnapshot(payload.payload);
    if (!snapshot) return null;
    return {
      ...snapshot,
      updatedAtMs: isValidUpdatedAtMs(payload.updatedAtMs)
        ? payload.updatedAtMs
        : snapshot.updatedAtMs,
    };
  }

  async save(context: ListDraftContext, snapshot: ListEditorDraftSnapshot): Promise<void> {
    const body = {
      kind: LIST_EDITOR_DRAFT_KIND,
      scope: context.scopeId,
      payload: snapshot,
    };
    const res = await fetch("/api/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Remote draft save failed (${res.status})`);
    }
  }

  async clear(context: ListDraftContext): Promise<void> {
    const query = new URLSearchParams({
      kind: LIST_EDITOR_DRAFT_KIND,
      scope: context.scopeId,
    });
    const res = await fetch(`/api/drafts?${query.toString()}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Remote draft clear failed (${res.status})`);
    }
  }
}

export class HybridListDraftStore implements ListDraftStore {
  constructor(
    private readonly localStore: ListDraftStore,
    private readonly remoteStore: ListDraftStore,
  ) {}

  async load(context: ListDraftContext): Promise<ListEditorDraftSnapshot | null> {
    const [localResult, remoteResult] = await Promise.allSettled([
      Promise.resolve(this.localStore.load(context)),
      Promise.resolve(this.remoteStore.load(context)),
    ]);
    const localDraft = localResult.status === "fulfilled" ? localResult.value : null;
    const remoteDraft = remoteResult.status === "fulfilled" ? remoteResult.value : null;

    if (!localDraft && !remoteDraft) return null;
    if (!remoteDraft && localDraft) return localDraft;
    if (!localDraft && remoteDraft) {
      await Promise.resolve(this.localStore.save(context, remoteDraft));
      return remoteDraft;
    }

    if (!localDraft || !remoteDraft) return null;
    const winner = localDraft.updatedAtMs >= remoteDraft.updatedAtMs ? localDraft : remoteDraft;
    const loserStore = winner === localDraft ? this.remoteStore : this.localStore;

    try {
      await Promise.resolve(loserStore.save(context, winner));
    } catch {
      // Best effort sync.
    }
    return winner;
  }

  async save(context: ListDraftContext, snapshot: ListEditorDraftSnapshot): Promise<void> {
    await Promise.resolve(this.localStore.save(context, snapshot));
    try {
      await Promise.resolve(this.remoteStore.save(context, snapshot));
    } catch {
      // Best effort sync.
    }
  }

  async clear(context: ListDraftContext): Promise<void> {
    await Promise.resolve(this.localStore.clear(context));
    try {
      await Promise.resolve(this.remoteStore.clear(context));
    } catch {
      // Best effort sync.
    }
  }
}
