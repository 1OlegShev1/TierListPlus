export function createInMemoryStorage(initialEntries?: Iterable<[string, string]>): Storage {
  const data = new Map(initialEntries);

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(String(key)) ?? null;
    },
    key(index: number) {
      const normalized = Number(index);
      if (!Number.isFinite(normalized) || normalized < 0) return null;
      return Array.from(data.keys())[normalized] ?? null;
    },
    removeItem(key: string) {
      data.delete(String(key));
    },
    setItem(key: string, value: string) {
      data.set(String(key), String(value));
    },
  };
}

export function ensureLocalStorageApi(): Storage {
  const root = globalThis as Record<string, unknown>;
  const current = root.localStorage as Partial<Storage> | undefined;

  const hasApi =
    !!current &&
    typeof current.getItem === "function" &&
    typeof current.setItem === "function" &&
    typeof current.removeItem === "function" &&
    typeof current.clear === "function" &&
    typeof current.key === "function";

  if (hasApi) {
    return current as Storage;
  }

  const replacement = createInMemoryStorage();
  Object.defineProperty(root, "localStorage", {
    configurable: true,
    writable: true,
    value: replacement,
  });
  return replacement;
}
