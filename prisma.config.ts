import { createRequire } from "node:module";
import { defineConfig, env } from "prisma/config";

const require = createRequire(import.meta.url);
try {
  require("dotenv/config");
} catch {
  // In lean production images we rely on injected DATABASE_URL instead of .env files.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
