const STORAGE_KEY = "tierlistplus_identity";
const LEGACY_STORAGE_KEY = "tierlistplus_user_id";

export interface StoredIdentity {
  userId: string;
  deviceId: string;
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
async function createUser(): Promise<StoredIdentity> {
  const res = await fetch("/api/users", { method: "POST" });
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
async function getSessionIdentity(): Promise<StoredIdentity | null> {
  const res = await fetch("/api/users/session", { cache: "no-store" });
  if (res.status === 401) return null;
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

  return { userId, deviceId };
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
  if (!pending) {
    pending = (async () => {
      const sessionIdentity = await getSessionIdentity();
      if (sessionIdentity) {
        if (
          !existing ||
          sessionIdentity.userId !== existing.userId ||
          sessionIdentity.deviceId !== existing.deviceId
        ) {
          saveLocalIdentity(sessionIdentity);
        }
        return sessionIdentity;
      }
      return createUser();
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export async function ensureUserId(): Promise<string> {
  const identity = await ensureUserIdentity();
  return identity.userId;
}
