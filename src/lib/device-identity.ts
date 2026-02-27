const STORAGE_KEY = "tierlistplus_user_id";

/** Read the stored userId from localStorage (returns null on server or if missing). */
export function getLocalUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** Store a userId in localStorage. */
export function saveLocalUserId(userId: string) {
  localStorage.setItem(STORAGE_KEY, userId);
}

/** Create a new user on the server and persist the id locally. Returns the userId. */
async function createUser(): Promise<string> {
  const res = await fetch("/api/users", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create user");
  const { id } = await res.json();
  saveLocalUserId(id);
  return id;
}

/** Validate that a signed user session cookie exists and return its user id. */
async function getSessionUserId(): Promise<string | null> {
  const res = await fetch("/api/users/session", { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to validate user session");
  const data = (await res.json()) as { id?: unknown };
  return typeof data.id === "string" && data.id.length > 0 ? data.id : null;
}

/** Singleton promise to prevent concurrent user creation. */
let pending: Promise<string> | null = null;

/**
 * Get the current userId, creating a new user if none exists.
 * Uses a singleton promise to prevent duplicate creation from concurrent calls.
 * Should only be called client-side.
 */
export function ensureUserId(): Promise<string> {
  const existing = getLocalUserId();
  if (!pending) {
    pending = (async () => {
      const sessionUserId = await getSessionUserId();
      if (sessionUserId) {
        if (sessionUserId !== existing) saveLocalUserId(sessionUserId);
        return sessionUserId;
      }
      return createUser();
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}
