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

function ensureLocalStorageApi(): void {
  const root = globalThis as Record<string, unknown>;
  const current = root.localStorage as (Storage & Record<string, unknown>) | undefined;

  if (!current || typeof current !== "object") {
    Object.defineProperty(root, "localStorage", {
      configurable: true,
      writable: true,
      value: createInMemoryStorage(),
    });
    return;
  }

  const hasStorageApi =
    typeof current.getItem === "function" &&
    typeof current.setItem === "function" &&
    typeof current.removeItem === "function" &&
    typeof current.clear === "function" &&
    typeof current.key === "function";

  if (hasStorageApi) return;

  const initial = new Map<string, string>();
  for (const [key, value] of Object.entries(current)) {
    if (STORAGE_API_KEYS.has(key)) continue;
    if (typeof value === "string") {
      initial.set(key, value);
    }
  }

  const patched = createInMemoryStorage(initial);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(patched))) {
    Object.defineProperty(current, key, descriptor);
  }
}

ensureLocalStorageApi();

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
