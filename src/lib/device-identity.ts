const STORAGE_KEY = "tierlistplus_identity";
const LEGACY_STORAGE_KEY = "tierlistplus_user_id";

export interface StoredIdentity {
  userId: string;
  deviceId: string;
}

export type SessionFailureCode =
  | "SESSION_COOKIE_MISSING"
  | "SESSION_TOKEN_INVALID"
  | "SESSION_DEVICE_NOT_FOUND"
  | "SESSION_DEVICE_REVOKED";

const SESSION_FAILURE_CODES = new Set<SessionFailureCode>([
  "SESSION_COOKIE_MISSING",
  "SESSION_TOKEN_INVALID",
  "SESSION_DEVICE_NOT_FOUND",
  "SESSION_DEVICE_REVOKED",
]);

export class IdentityRecoveryRequiredError extends Error {
  constructor(
    public code: SessionFailureCode,
    public rememberedIdentity: StoredIdentity | null,
  ) {
    super("This browser remembers an existing workspace, but its secure session is missing.");
    this.name = "IdentityRecoveryRequiredError";
  }
}

function getLegacyLocalUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LEGACY_STORAGE_KEY);
}

export function getLocalIdentity(): StoredIdentity | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; deviceId?: unknown };
    if (typeof parsed.userId !== "string" || parsed.userId.length === 0) return null;
    if (typeof parsed.deviceId !== "string" || parsed.deviceId.length === 0) return null;
    return { userId: parsed.userId, deviceId: parsed.deviceId };
  } catch {
    return null;
  }
}

/** Read the stored userId from localStorage (returns null on server or if missing). */
export function getLocalUserId(): string | null {
  return getLocalIdentity()?.userId ?? getLegacyLocalUserId();
}

export function getLocalDeviceId(): string | null {
  return getLocalIdentity()?.deviceId ?? null;
}

/** Store the active identity in localStorage. */
export function saveLocalIdentity(identity: StoredIdentity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function clearLocalIdentity() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

/** Create a new user on the server and persist the identity locally. */
async function createUser(reason: "FIRST_VISIT" | "EXPLICIT_FRESH_START"): Promise<StoredIdentity> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Failed to create user");
  const data = (await res.json()) as {
    id?: unknown;
    userId?: unknown;
    deviceId?: unknown;
  };

  const userId =
    typeof data.userId === "string" && data.userId.length > 0
      ? data.userId
      : typeof data.id === "string" && data.id.length > 0
        ? data.id
        : null;
  const deviceId =
    typeof data.deviceId === "string" && data.deviceId.length > 0 ? data.deviceId : null;

  if (!userId || !deviceId) throw new Error("Failed to create user");

  const identity = { userId, deviceId };
  saveLocalIdentity(identity);
  return identity;
}

/** Validate that a signed user session cookie exists and return its identity. */
async function getSessionIdentity(): Promise<
  { ok: true; identity: StoredIdentity } | { ok: false; code: SessionFailureCode }
> {
  const res = await fetch("/api/users/session", { cache: "no-store" });
  if (res.status === 401) {
    const data = (await res.json().catch(() => null)) as { code?: unknown } | null;
    const code =
      typeof data?.code === "string" && SESSION_FAILURE_CODES.has(data.code as SessionFailureCode)
        ? (data.code as SessionFailureCode)
        : "SESSION_TOKEN_INVALID";
    return { ok: false, code };
  }
  if (!res.ok) throw new Error("Failed to validate user session");
  const data = (await res.json()) as { id?: unknown; userId?: unknown; deviceId?: unknown };
  const userId =
    typeof data.userId === "string" && data.userId.length > 0
      ? data.userId
      : typeof data.id === "string" && data.id.length > 0
        ? data.id
        : null;
  const deviceId =
    typeof data.deviceId === "string" && data.deviceId.length > 0 ? data.deviceId : null;

  if (!userId || !deviceId) throw new Error("Failed to validate user session");

  return { ok: true, identity: { userId, deviceId } };
}

/** Singleton promise to prevent concurrent user creation. */
let pending: Promise<StoredIdentity> | null = null;

/**
 * Get the current identity, creating a new user if none exists.
 * Uses a singleton promise to prevent duplicate creation from concurrent calls.
 * Should only be called client-side.
 */
export function ensureUserIdentity(): Promise<StoredIdentity> {
  const existing = getLocalIdentity();
  const hasRememberedIdentity = existing != null || getLegacyLocalUserId() != null;
  if (!pending) {
    pending = (async () => {
      const sessionResult = await getSessionIdentity();
      if (sessionResult.ok) {
        const sessionIdentity = sessionResult.identity;
        if (
          !existing ||
          sessionIdentity.userId !== existing.userId ||
          sessionIdentity.deviceId !== existing.deviceId
        ) {
          saveLocalIdentity(sessionIdentity);
        }
        return sessionIdentity;
      }

      if (hasRememberedIdentity) {
        throw new IdentityRecoveryRequiredError(sessionResult.code, existing);
      }

      return createUser("FIRST_VISIT");
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function startFreshIdentity(): Promise<StoredIdentity> {
  clearLocalIdentity();
  if (!pending) {
    pending = createUser("EXPLICIT_FRESH_START").finally(() => {
      pending = null;
    });
  }
  return pending;
}

export async function ensureUserId(): Promise<string> {
  const identity = await ensureUserIdentity();
  return identity.userId;
}
