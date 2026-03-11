import { Prisma } from "@prisma/client";
import { vi } from "vitest";

const FIXED_DATE = new Date("2026-03-02T12:00:00.000Z");

export function createPrismaMock() {
  return {
    $transaction: vi.fn(),
    session: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    tierVote: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    sessionItem: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    template: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    templateItem: {
      update: vi.fn(),
      delete: vi.fn(),
    },
    device: {
      findMany: vi.fn(),
    },
    linkCode: {
      findFirst: vi.fn(),
    },
    bracket: {
      findFirst: vi.fn(),
    },
  };
}

export function resetPrismaMock(prismaMock: ReturnType<typeof createPrismaMock>) {
  for (const value of Object.values(prismaMock)) {
    if (typeof value === "function" && "mockReset" in value) {
      (value as ReturnType<typeof vi.fn>).mockReset();
      continue;
    }

    if (value && typeof value === "object") {
      for (const nested of Object.values(value)) {
        if (typeof nested === "function" && "mockReset" in nested) {
          (nested as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
  }
}

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_1",
    role: "USER",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

export function makeDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "device_1",
    userId: "user_1",
    displayName: "Device 1",
    isMigrationSeed: false,
    revokedAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    lastSeenAt: FIXED_DATE,
    ...overrides,
  };
}

export function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session_1",
    name: "Session",
    joinCode: "JOIN1",
    status: "OPEN",
    creatorId: "user_1",
    isPrivate: true,
    isLocked: false,
    isModeratedHidden: false,
    moderatedByUserId: null,
    moderationReason: null,
    moderatedAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    tierConfig: [
      { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
      { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
    ],
    ...overrides,
  };
}

export function makeParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: "participant_1",
    sessionId: "session_1",
    userId: "user_1",
    nickname: "Oleg",
    submittedAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

export function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template_1",
    name: "Template",
    description: null,
    creatorId: "user_1",
    isPublic: false,
    isHidden: false,
    isModeratedHidden: false,
    moderatedByUserId: null,
    moderationReason: null,
    moderatedAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    items: [],
    _count: { items: 0 },
    ...overrides,
  };
}

export function makeSessionItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item_1",
    label: "Item 1",
    imageUrl: "/img/1.webp",
    sortOrder: 0,
    ...overrides,
  };
}

export function makeTierVote(overrides: Record<string, unknown> = {}) {
  return {
    participantId: "participant_1",
    sessionItemId: "item_1",
    tierKey: "S",
    rankInTier: 0,
    ...overrides,
  };
}

export function makeKnownRequestError(
  code: "P2002" | "P2003" | "P2025",
  target?: string[],
): Prisma.PrismaClientKnownRequestError {
  const error = new Error(`Prisma ${code}`) as Prisma.PrismaClientKnownRequestError;
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  Object.assign(error, {
    code,
    clientVersion: "test",
    meta: target ? { target } : undefined,
  });
  return error;
}
