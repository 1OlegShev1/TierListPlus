import { afterEach, vi } from "vitest";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/tierlistplus_test";
const ORIGINAL_ENV = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };

process.env.DATABASE_URL = TEST_DATABASE_URL;

// localStorage is supplied by jsdom in component tests. Node's experimental Web
// Storage is disabled via `--no-webstorage` (see vitest.config.ts), so it can no
// longer shadow jsdom's implementation with a broken global.

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
