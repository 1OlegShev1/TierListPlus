export const THEME_PREFERENCE_STORAGE_KEY = "tierlist-theme-preference";
export const THEME_PREFERENCE_CHANGE_EVENT = "tierlist-theme-preference-change";

export type ThemePreference = "dark" | "light" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["dark", "light", "system"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function readStoredThemePreference(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  return isThemePreference(stored) ? stored : null;
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
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
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
