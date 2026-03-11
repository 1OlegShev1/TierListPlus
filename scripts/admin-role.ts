import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma, type UserRole } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function printUsage() {
  console.log(`Usage:
  npm run admin:role -- --list [--limit 50]
  npm run admin:role -- --user <USER_ID> [--role ADMIN|MODERATOR|USER]

Examples:
  npm run admin:role -- --list
  npm run admin:role -- --user cm9abc123 --role ADMIN
  npm run admin:role -- --user cm9abc123 --role USER`);
}

function parseRole(raw: string | undefined): UserRole | null {
  if (!raw) return null;
  const value = raw.toUpperCase();
  if (value === "USER" || value === "MODERATOR" || value === "ADMIN") return value;
  return null;
}

function parseInteger(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

async function listUsers(limit: number) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      nickname: true,
      role: true,
      createdAt: true,
      devices: {
        where: { revokedAt: null },
        orderBy: { lastSeenAt: "desc" },
        take: 1,
        select: {
          displayName: true,
          lastSeenAt: true,
        },
      },
      _count: {
        select: {
          devices: true,
          templates: true,
          sessions: true,
          participants: true,
        },
      },
    },
  });

  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  console.log(
    "id | role | nickname | createdAt | lastSeenAt | devices | templates | sessions | participants",
  );
  for (const user of users) {
    const lastSeenAt = user.devices[0]?.lastSeenAt.toISOString() ?? "-";
    console.log(
      [
        user.id,
        user.role,
        user.nickname ?? "-",
        user.createdAt.toISOString(),
        lastSeenAt,
        user._count.devices,
        user._count.templates,
        user._count.sessions,
        user._count.participants,
      ].join(" | "),
    );
  }
}

async function setRole(userId: string, role: UserRole) {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true, nickname: true, createdAt: true },
    });
    console.log(
      `Updated user ${updated.id}: role=${updated.role}, nickname=${updated.nickname ?? "-"}`,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error(`User not found: ${userId}`);
    }
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  if (args.includes("--list")) {
    const limit = parseInteger(getArgValue(args, "--limit"), 50);
    await listUsers(limit);
    return;
  }

  const userId = getArgValue(args, "--user");
  if (!userId) {
    printUsage();
    throw new Error("Missing required --user argument");
  }

  const roleRaw = getArgValue(args, "--role");
  const role = parseRole(roleRaw ?? "ADMIN");
  if (!role) {
    printUsage();
    throw new Error("Invalid --role value. Use USER, MODERATOR, or ADMIN");
  }

  await setRole(userId, role);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
