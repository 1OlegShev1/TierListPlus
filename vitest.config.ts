import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/consensus.ts",
        "src/lib/bracket-ranking.ts",
        "src/lib/bracket-generator.ts",
        "src/lib/template-access.ts",
        "src/lib/constants.ts",
        "src/lib/validators.ts",
        "src/lib/user-session.ts",
        "src/lib/vote-draft.ts",
        "src/lib/account-linking-helpers.ts",
        "src/hooks/useTierList.ts",
        "src/hooks/useParticipant.ts",
        "src/app/api/sessions/route.ts",
        "src/app/api/sessions/join/route.ts",
        "src/app/api/sessions/[sessionId]/route.ts",
        "src/app/api/sessions/[sessionId]/votes/route.ts",
        "src/app/api/sessions/[sessionId]/bracket/rankings/route.ts",
        "src/app/api/templates/route.ts",
        "src/app/api/users/route.ts",
        "src/app/api/users/session/route.ts",
        "src/app/api/users/devices/route.ts",
      ],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/upload.ts",
        "src/lib/upload-gc.ts",
        "src/lib/auth.ts",
        "src/app/api/upload/route.ts",
      ],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
