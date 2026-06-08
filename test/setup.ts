import { afterEach, vi } from "vitest";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/tierlistplus_test";
const ORIGINAL_ENV = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };

process.env.DATABASE_URL = TEST_DATABASE_URL;

const STORAGE_API_KEYS = new Set(["length", "key", "getItem", "setItem", "removeItem", "clear"]);

function createInMemoryStorage(initial?: Map<string, string>): Storage {
  const data = new Map(initial);
  const storage = {} as Storage & Record<string, unknown>;

  Object.defineProperty(storage, "length", {
    configurable: true,
    enumerable: false,
    get: () => data.size,
  });

  Object.defineProperty(storage, "clear", {
    configurable: true,
    writable: true,
    value: () => {
      data.clear();
    },
  });

  Object.defineProperty(storage, "getItem", {
    configurable: true,
    writable: true,
    value: (key: string) => data.get(String(key)) ?? null,
  });

  Object.defineProperty(storage, "key", {
    configurable: true,
    writable: true,
    value: (index: number) => {
      const normalizedIndex = Number(index);
      if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0) return null;
      return Array.from(data.keys())[normalizedIndex] ?? null;
    },
  });

  Object.defineProperty(storage, "removeItem", {
    configurable: true,
    writable: true,
    value: (key: string) => {
      data.delete(String(key));
    },
  });

  Object.defineProperty(storage, "setItem", {
    configurable: true,
    writable: true,
    value: (key: string, value: string) => {
      data.set(String(key), String(value));
    },
  });

  return storage;
}

function hasWorkingStorageApi(value: unknown): value is Storage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function" &&
    typeof candidate.clear === "function" &&
    typeof candidate.key === "function"
  );
}

function readInitialEntries(value: unknown): Map<string, string> {
  const initial = new Map<string, string>();
  if (!value || typeof value !== "object") return initial;
  // A broken Storage may be a Proxy whose get trap returns undefined, so guard each read.
  try {
    for (const [key, entry] of Object.entries(value)) {
      if (STORAGE_API_KEYS.has(key)) continue;
      if (typeof entry === "string") {
        initial.set(key, entry);
      }
    }
  } catch {
    // Ignore: an inaccessible store contributes no entries.
  }
  return initial;
}

// Node 24's experimental Web Storage (enabled by vitest passing `--localstorage-file`
// with an empty path) installs a broken `localStorage` Proxy whose methods resolve to
// `undefined`. It shadows jsdom's storage and cannot be patched in place, because a
// Proxy's get trap ignores any properties we (re)define on it. So when the existing
// binding lacks a working API, replace the global outright with an in-memory store.
function ensureStorageApi(name: "localStorage" | "sessionStorage"): void {
  const targets: Array<Record<string, unknown>> = [globalThis as Record<string, unknown>];
  const maybeWindow = (globalThis as unknown as { window?: Record<string, unknown> }).window;
  if (maybeWindow && maybeWindow !== globalThis) {
    targets.push(maybeWindow);
  }

  const current = (globalThis as Record<string, unknown>)[name];
  if (hasWorkingStorageApi(current)) return;

  const replacement = createInMemoryStorage(readInitialEntries(current));
  for (const target of targets) {
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: replacement,
    });
  }
}

ensureStorageApi("localStorage");
ensureStorageApi("sessionStorage");

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();

  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
});
