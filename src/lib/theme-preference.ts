export const THEME_PREFERENCE_STORAGE_KEY = "tierlist-theme-preference";
export const THEME_PREFERENCE_CHANGE_EVENT = "tierlist-theme-preference-change";

export type ThemePreference = "dark" | "light" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["dark", "light", "system"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage || typeof storage !== "object") return null;
  if (typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return null;
  return storage as Storage;
}

export function readStoredThemePreference(): ThemePreference | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const stored = storage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return isThemePreference(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function readDocumentThemePreference(): ThemePreference | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.theme;
  return isThemePreference(value) ? value : null;
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", preference);
}

export function persistThemePreference(preference: ThemePreference) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // ignore unavailable storage (e.g., browser privacy mode)
  }
}

export function notifyThemePreferenceChanged(preference: ThemePreference) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThemePreference>(THEME_PREFERENCE_CHANGE_EVENT, {
      detail: preference,
    }),
  );
}

export function resolveThemePreference(defaultTheme: ThemePreference = "dark"): ThemePreference {
  return readStoredThemePreference() ?? readDocumentThemePreference() ?? defaultTheme;
}
