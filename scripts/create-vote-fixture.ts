import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type SessionStatus, type SourceProvider } from "@prisma/client";
import { DEFAULT_TIER_CONFIG, type TierConfig } from "@/lib/constants";
import { generateJoinCode } from "@/lib/nanoid";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type TemplateWithItems = Awaited<ReturnType<typeof loadTemplates>>[number];

interface CliOptions {
  listOnly: boolean;
  cleanup: boolean;
  templateId: string | null;
  templateName: string | null;
  voters: number;
  status: SessionStatus;
  isPrivate: boolean;
  seed: number;
  name: string | null;
  spaceName: string | null;
  spaceId: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  let listOnly = false;
  let cleanup = false;
  let templateId: string | null = null;
  let templateName: string | null = null;
  let voters = 24;
  let status: SessionStatus = "CLOSED";
  let isPrivate = false;
  let seed = Date.now();
  let name: string | null = null;
  let spaceName: string | null = null;
  let spaceId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") {
      listOnly = true;
      continue;
    }
    if (arg === "--cleanup") {
      cleanup = true;
      continue;
    }
    if (arg === "--template-id") {
      templateId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--template") {
      templateName = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--voters") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("--voters must be a positive integer");
      }
      voters = parsed;
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const value = (argv[index + 1] ?? "").toUpperCase();
      if (value !== "OPEN" && value !== "CLOSED" && value !== "ARCHIVED") {
        throw new Error("--status must be OPEN, CLOSED, or ARCHIVED");
      }
      status = value;
      index += 1;
      continue;
    }
    if (arg === "--private") {
      isPrivate = true;
      continue;
    }
    if (arg === "--seed") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(parsed)) {
        throw new Error("--seed must be an integer");
      }
      seed = parsed;
      index += 1;
      continue;
    }
    if (arg === "--name") {
      name = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--space-name") {
      spaceName = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--space-id") {
      spaceId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (spaceName && spaceId) {
    throw new Error("Use either --space-name or --space-id, not both");
  }
  if (cleanup && listOnly) {
    throw new Error("Use either --cleanup or --list, not both");
  }

  return {
    listOnly,
    cleanup,
    templateId,
    templateName,
    voters,
    status,
    isPrivate,
    seed,
    name,
    spaceName,
    spaceId,
  };
}

async function cleanupFixtures() {
  const fixtureTemplates = await prisma.template.findMany({
    where: {
      isHidden: true,
      name: {
        endsWith: "[Fixture]",
      },
    },
    select: {
      id: true,
    },
  });

  if (fixtureTemplates.length === 0) {
    return {
      sessionsDeleted: 0,
      templatesDeleted: 0,
      spacesDeleted: 0,
    };
  }

  const fixtureTemplateIds = fixtureTemplates.map((template) => template.id);

  const [sessionDeleteResult, templateDeleteResult] = await prisma.$transaction([
    prisma.session.deleteMany({
      where: {
        templateId: {
          in: fixtureTemplateIds,
        },
      },
    }),
    prisma.template.deleteMany({
      where: {
        id: {
          in: fixtureTemplateIds,
        },
      },
    }),
  ]);

  const candidateSpaces = await prisma.space.findMany({
    where: {
      description: {
        startsWith: 'Synthetic fixture space for "',
      },
    },
    select: {
      id: true,
      _count: {
        select: {
          templates: true,
          sessions: true,
          invites: true,
          members: true,
        },
      },
    },
  });

  const spaceIdsToDelete = candidateSpaces
    .filter(
      (space) =>
        space._count.templates === 0 &&
        space._count.sessions === 0 &&
        space._count.invites === 0 &&
        space._count.members === 0,
    )
    .map((space) => space.id);

  const spaceDeleteResult =
    spaceIdsToDelete.length > 0
      ? await prisma.space.deleteMany({
          where: {
            id: {
              in: spaceIdsToDelete,
            },
          },
        })
      : { count: 0 };

  return {
    sessionsDeleted: sessionDeleteResult.count,
    templatesDeleted: templateDeleteResult.count,
    spacesDeleted: spaceDeleteResult.count,
  };
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pickTierCounts(itemCount: number, tierCount: number): number[] {
  if (itemCount <= 0) return Array.from({ length: tierCount }, () => 0);

  const weights = [0.12, 0.2, 0.28, 0.22, 0.18];
  const normalizedWeights =
    tierCount === weights.length ? weights : Array.from({ length: tierCount }, () => 1 / tierCount);

  const counts = normalizedWeights.map((weight) => Math.floor(itemCount * weight));
  let assigned = counts.reduce((sum, count) => sum + count, 0);

  while (assigned < itemCount) {
    const nextIndex = assigned % tierCount;
    counts[nextIndex] += 1;
    assigned += 1;
  }

  return counts;
}

function buildVotesForParticipant({
  participantIndex,
  items,
  tierConfig,
  rng,
}: {
  participantIndex: number;
  items: { id: string; sortOrder: number }[];
  tierConfig: TierConfig[];
  rng: () => number;
}) {
  const totalItems = items.length;
  const totalTiers = tierConfig.length;
  const tierCounts = pickTierCounts(totalItems, totalTiers);

  const scored = items
    .map((item, itemIndex) => {
      const baseRank = item.sortOrder || itemIndex;
      const participantBias = (participantIndex % totalTiers) - Math.floor(totalTiers / 2);
      const noise = (rng() - 0.5) * Math.max(totalItems * 0.75, 3);
      const score = baseRank + participantBias * 0.35 + noise;
      return {
        id: item.id,
        score,
      };
    })
    .sort((a, b) => a.score - b.score);

  const votes: {
    participantId: string;
    sessionItemId: string;
    tierKey: string;
    rankInTier: number;
  }[] = [];

  let cursor = 0;
  for (let tierIndex = 0; tierIndex < tierConfig.length; tierIndex += 1) {
    const tier = tierConfig[tierIndex];
    const bucketSize = tierCounts[tierIndex] ?? 0;
    for (let rankInTier = 0; rankInTier < bucketSize && cursor < scored.length; rankInTier += 1) {
      votes.push({
        participantId: "",
        sessionItemId: scored[cursor].id,
        tierKey: tier.key,
        rankInTier,
      });
      cursor += 1;
    }
  }

  while (cursor < scored.length) {
    const fallbackTier = tierConfig[clamp(tierConfig.length - 1, 0, tierConfig.length - 1)];
    votes.push({
      participantId: "",
      sessionItemId: scored[cursor].id,
      tierKey: fallbackTier.key,
      rankInTier: 0,
    });
    cursor += 1;
  }

  return votes;
}

async function loadTemplates() {
  return prisma.template.findMany({
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          label: true,
          imageUrl: true,
          sourceUrl: true,
          sourceProvider: true,
          sourceNote: true,
          sourceStartSec: true,
          sourceEndSec: true,
          sortOrder: true,
        },
      },
      _count: {
        select: {
          items: true,
          sessions: true,
        },
      },
    },
    orderBy: [{ isHidden: "asc" }, { updatedAt: "desc" }],
  });
}

function selectTemplate(
  templates: TemplateWithItems[],
  options: Pick<CliOptions, "templateId" | "templateName">,
) {
  if (options.templateId) {
    return templates.find((template) => template.id === options.templateId) ?? null;
  }

  if (options.templateName) {
    const normalized = options.templateName.trim().toLocaleLowerCase();
    const exact =
      templates.find((template) => template.name.toLocaleLowerCase() === normalized) ?? null;
    if (exact) return exact;
    return (
      templates.find((template) => template.name.toLocaleLowerCase().includes(normalized)) ?? null
    );
  }

  return (
    [...templates]
      .filter((template) => template._count.items > 0)
      .sort((left, right) => {
        if (left.isHidden !== right.isHidden) return Number(left.isHidden) - Number(right.isHidden);
        return right._count.items - left._count.items;
      })[0] ?? null
  );
}

function buildParticipantNickname(index: number) {
  if (index === 0) return "Host";
  return `Voter ${String(index + 1).padStart(2, "0")}`;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("create-vote-fixture script is disabled in production");
  }

  const options = parseArgs(process.argv.slice(2));

  if (options.cleanup) {
    const result = await cleanupFixtures();
    console.log("Fixture cleanup completed.");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const templates = await loadTemplates();

  if (options.listOnly) {
    if (templates.length === 0) {
      console.log("No templates found.");
      return;
    }

    console.table(
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        items: template._count.items,
        sessions: template._count.sessions,
        hidden: template.isHidden,
        public: template.isPublic,
      })),
    );
    return;
  }

  const sourceTemplate = selectTemplate(templates, options);
  if (!sourceTemplate) {
    throw new Error("No matching template found. Run with --list to inspect available templates.");
  }
  if (sourceTemplate.items.length === 0) {
    throw new Error(`Template "${sourceTemplate.name}" has no items`);
  }

  const creator = await prisma.user.findFirst({
    select: { id: true, nickname: true },
    orderBy: { createdAt: "asc" },
  });
  if ((options.spaceName || options.spaceId) && !creator) {
    throw new Error(
      "Cannot create a space fixture without at least one existing user in the database",
    );
  }
  const tierConfig = DEFAULT_TIER_CONFIG;
  const fixtureName =
    options.name ?? `${sourceTemplate.name} Prototype (${options.voters} synthetic voters)`;
  const rng = createRng(options.seed);
  const timestamp = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existingSpace = options.spaceId
      ? await tx.space.findUnique({
          where: { id: options.spaceId },
          select: { id: true, name: true },
        })
      : null;
    if (options.spaceId && !existingSpace) {
      throw new Error(`Space "${options.spaceId}" not found`);
    }

    const space =
      existingSpace ??
      (options.spaceName && creator
        ? await tx.space.create({
            data: {
              name: options.spaceName,
              description: `Synthetic fixture space for "${fixtureName}"`,
              creatorId: creator.id,
              visibility: "OPEN",
              accentColor: "SLATE",
            },
          })
        : null);

    const workingTemplate = await tx.template.create({
      data: {
        name: `${fixtureName} [Fixture]`,
        description: `Synthetic vote fixture cloned from "${sourceTemplate.name}"`,
        creatorId: creator?.id ?? sourceTemplate.creatorId ?? null,
        spaceId: space?.id ?? null,
        isPublic: false,
        isHidden: true,
        items: {
          create: sourceTemplate.items.map((item) => ({
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl,
            sourceProvider: item.sourceProvider as SourceProvider | null,
            sourceNote: item.sourceNote,
            sourceStartSec: item.sourceStartSec,
            sourceEndSec: item.sourceEndSec,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, sortOrder: true },
        },
      },
    });

    const session = await tx.session.create({
      data: {
        name: fixtureName,
        templateId: workingTemplate.id,
        sourceTemplateId: sourceTemplate.id,
        joinCode: generateJoinCode(),
        status: options.status,
        creatorId: creator?.id ?? sourceTemplate.creatorId ?? null,
        isPrivate: space ? true : options.isPrivate,
        spaceId: space?.id ?? null,
        tierConfig: JSON.parse(JSON.stringify(tierConfig)),
        items: {
          create: sourceTemplate.items.map((item, index) => ({
            templateItemId: workingTemplate.items[index].id,
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl,
            sourceProvider: item.sourceProvider as SourceProvider | null,
            sourceNote: item.sourceNote,
            sourceStartSec: item.sourceStartSec,
            sourceEndSec: item.sourceEndSec,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            sortOrder: true,
          },
        },
      },
    });

    const participants = Array.from({ length: options.voters }, (_, index) => ({
      id: randomUUID(),
      sessionId: session.id,
      nickname: buildParticipantNickname(index),
      userId: index === 0 ? (creator?.id ?? null) : null,
      submittedAt: options.status === "OPEN" ? null : timestamp,
    }));

    await tx.participant.createMany({
      data: participants,
    });

    const tierVotes = participants.flatMap((participant, participantIndex) =>
      buildVotesForParticipant({
        participantIndex,
        items: session.items,
        tierConfig,
        rng,
      }).map((vote) => ({
        ...vote,
        participantId: participant.id,
      })),
    );

    await tx.tierVote.createMany({
      data: tierVotes,
    });

    return {
      sessionId: session.id,
      spaceId: space?.id ?? null,
      spaceName: space?.name ?? null,
      joinCode: session.joinCode,
      participantCount: participants.length,
      itemCount: session.items.length,
      templateName: sourceTemplate.name,
      creatorId: creator?.id ?? null,
      creatorNickname: creator?.nickname ?? null,
    };
  });

  console.log("Fixture created.");
  console.log(JSON.stringify(result, null, 2));
  console.log(`Results URL: /sessions/${result.sessionId}/results`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
