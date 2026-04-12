const STORAGE_KEY_PREFIX = "tierlistplus_vote_draft_v1";
const VOTE_BOARD_DRAFT_VERSION = 1 as const;
const VOTE_BOARD_DRAFT_KIND = "VOTE_BOARD" as const;
const DEFAULT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type DraftApiKind = "LIST_EDITOR" | "VOTE_BOARD";

export interface VoteBoardDraftSnapshot {
  version: typeof VOTE_BOARD_DRAFT_VERSION;
  updatedAtMs: number;
  tiers: Record<string, string[]>;
  unranked: string[];
}

export interface VoteDraftContext {
  userId: string;
  scopeId: string;
  tierKeys: string[];
  validItemIds: Set<string>;
}

export interface VoteDraftStore {
  load(
    context: VoteDraftContext,
  ): Promise<VoteBoardDraftSnapshot | null> | VoteBoardDraftSnapshot | null;
  save(context: VoteDraftContext, snapshot: VoteBoardDraftSnapshot): Promise<void> | void;
  clear(context: VoteDraftContext): Promise<void> | void;
}

interface ScopeInput {
  sessionId: string;
  participantId: string;
}

interface SnapshotInput {
  updatedAtMs?: number;
  tiers: Record<string, string[]>;
  unranked: string[];
  tierKeys: string[];
  validItemIds: Set<string>;
}

interface SnapshotNormalizationContext {
  tierKeys: string[];
  validItemIds: Set<string>;
}

interface RemoteDraftResponse {
  kind: DraftApiKind;
  scope: string;
  payload: unknown;
  updatedAtMs: number;
}

function isValidUpdatedAtMs(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function coerceItemId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTierKeys(tierKeys: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of tierKeys) {
    if (typeof key !== "string" || key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function normalizeIdList(
  value: unknown,
  validItemIds: Set<string>,
  seenItems: Set<string>,
): string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  for (const idRaw of value) {
    const id = coerceItemId(idRaw);
    if (!id) continue;
    if (!validItemIds.has(id) || seenItems.has(id)) continue;
    seenItems.add(id);
    normalized.push(id);
  }
  return normalized;
}

function normalizeSnapshot(
  value: unknown,
  context: SnapshotNormalizationContext,
): VoteBoardDraftSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== VOTE_BOARD_DRAFT_VERSION) return null;
  if (!isValidUpdatedAtMs(record.updatedAtMs)) return null;

  const tierKeys = normalizeTierKeys(context.tierKeys);
  const validItemIds = context.validItemIds;
  const rawTiers = record.tiers;
  const rawUnranked = record.unranked;
  const tierRecord =
    rawTiers && typeof rawTiers === "object" ? (rawTiers as Record<string, unknown>) : {};
  const seenItems = new Set<string>();

  const tiers: Record<string, string[]> = {};
  for (const tierKey of tierKeys) {
    tiers[tierKey] = normalizeIdList(tierRecord[tierKey], validItemIds, seenItems);
  }

  const unranked = normalizeIdList(rawUnranked, validItemIds, seenItems);
  for (const itemId of validItemIds) {
    if (!seenItems.has(itemId)) {
      seenItems.add(itemId);
      unranked.push(itemId);
    }
  }

  return {
    version: VOTE_BOARD_DRAFT_VERSION,
    updatedAtMs: record.updatedAtMs,
    tiers,
    unranked,
  };
}

export function buildVoteBoardScopeId({ sessionId, participantId }: ScopeInput): string {
  return `vote-board:${sessionId}:${participantId}`;
}

export function createVoteBoardDraftSnapshot(input: SnapshotInput): VoteBoardDraftSnapshot {
  const normalized = normalizeSnapshot(
    {
      version: VOTE_BOARD_DRAFT_VERSION,
      updatedAtMs: isValidUpdatedAtMs(input.updatedAtMs) ? input.updatedAtMs : Date.now(),
      tiers: input.tiers,
      unranked: input.unranked,
    },
    {
      tierKeys: input.tierKeys,
      validItemIds: input.validItemIds,
    },
  );

  if (normalized) {
    return normalized;
  }

  const tiers = Object.fromEntries(normalizeTierKeys(input.tierKeys).map((key) => [key, []]));
  return {
    version: VOTE_BOARD_DRAFT_VERSION,
    updatedAtMs: Date.now(),
    tiers,
    unranked: Array.from(input.validItemIds),
  };
}

export function areVoteBoardDraftsEquivalent(
  left: VoteBoardDraftSnapshot,
  right: VoteBoardDraftSnapshot,
  tierKeys: string[],
): boolean {
  const normalizedTierKeys = normalizeTierKeys(tierKeys);

  if (left.unranked.length !== right.unranked.length) return false;
  for (let index = 0; index < left.unranked.length; index += 1) {
    if (left.unranked[index] !== right.unranked[index]) return false;
  }

  for (const tierKey of normalizedTierKeys) {
    const leftTier = left.tiers[tierKey] ?? [];
    const rightTier = right.tiers[tierKey] ?? [];
    if (leftTier.length !== rightTier.length) return false;
    for (let index = 0; index < leftTier.length; index += 1) {
      if (leftTier[index] !== rightTier[index]) return false;
    }
  }

  return true;
}

export function getVoteDraftStorageKey(
  context: Pick<VoteDraftContext, "userId" | "scopeId">,
): string {
  return `${STORAGE_KEY_PREFIX}:${context.userId}:${context.scopeId}`;
}

export class LocalVoteDraftStore implements VoteDraftStore {
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options?: { now?: () => number; ttlMs?: number }) {
    this.now = options?.now ?? (() => Date.now());
    this.ttlMs = options?.ttlMs ?? DEFAULT_DRAFT_TTL_MS;
  }

  load(context: VoteDraftContext): VoteBoardDraftSnapshot | null {
    if (typeof window === "undefined") return null;

    try {
      const key = getVoteDraftStorageKey(context);
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        localStorage.removeItem(key);
        return null;
      }

      const parsed = normalizeSnapshot(parsedJson, context);
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

  save(context: VoteDraftContext, snapshot: VoteBoardDraftSnapshot): void {
    if (typeof window === "undefined") return;

    try {
      const normalized = normalizeSnapshot(snapshot, context);
      if (!normalized) return;
      localStorage.setItem(getVoteDraftStorageKey(context), JSON.stringify(normalized));
    } catch {
      // Ignore storage failures to keep ranking unblocked.
    }
  }

  clear(context: VoteDraftContext): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(getVoteDraftStorageKey(context));
    } catch {
      // Ignore storage failures to keep ranking unblocked.
    }
  }
}

export class RemoteVoteDraftStore implements VoteDraftStore {
  async load(context: VoteDraftContext): Promise<VoteBoardDraftSnapshot | null> {
    const query = new URLSearchParams({
      kind: VOTE_BOARD_DRAFT_KIND,
      scope: context.scopeId,
    });
    const response = await fetch(`/api/drafts?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Remote vote draft load failed (${response.status})`);
    }

    const payload = (await response.json()) as RemoteDraftResponse;
    if (payload.kind !== VOTE_BOARD_DRAFT_KIND) return null;
    const snapshot = normalizeSnapshot(payload.payload, context);
    if (!snapshot) return null;
    return {
      ...snapshot,
      updatedAtMs: isValidUpdatedAtMs(payload.updatedAtMs)
        ? payload.updatedAtMs
        : snapshot.updatedAtMs,
    };
  }

  async save(context: VoteDraftContext, snapshot: VoteBoardDraftSnapshot): Promise<void> {
    const normalized = normalizeSnapshot(snapshot, context);
    if (!normalized) return;

    const body = {
      kind: VOTE_BOARD_DRAFT_KIND,
      scope: context.scopeId,
      payload: normalized,
    };
    const response = await fetch("/api/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Remote vote draft save failed (${response.status})`);
    }
  }

  async clear(context: VoteDraftContext): Promise<void> {
    const query = new URLSearchParams({
      kind: VOTE_BOARD_DRAFT_KIND,
      scope: context.scopeId,
    });
    const response = await fetch(`/api/drafts?${query.toString()}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Remote vote draft clear failed (${response.status})`);
    }
  }
}

export class HybridVoteDraftStore implements VoteDraftStore {
  constructor(
    private readonly localStore: VoteDraftStore,
    private readonly remoteStore: VoteDraftStore,
  ) {}

  async load(context: VoteDraftContext): Promise<VoteBoardDraftSnapshot | null> {
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

  async save(context: VoteDraftContext, snapshot: VoteBoardDraftSnapshot): Promise<void> {
    await Promise.resolve(this.localStore.save(context, snapshot));
    try {
      await Promise.resolve(this.remoteStore.save(context, snapshot));
    } catch {
      // Best effort sync.
    }
  }

  async clear(context: VoteDraftContext): Promise<void> {
    await Promise.resolve(this.localStore.clear(context));
    try {
      await Promise.resolve(this.remoteStore.clear(context));
    } catch {
      // Best effort sync.
    }
  }
}
