import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export interface PublishTemplateItemInput {
  label: string;
  imageUrl: string;
  sourceUrl?: string | null;
  sourceNote?: string | null;
}

export interface PublishCollectionAsTemplateInput {
  creatorId: string;
  isPublic: boolean;
  templatePrefix: string;
  templateSuffix: string;
  sourcePage: string;
  items: PublishTemplateItemInput[];
  importedAtIso: string;
}

async function buildUniqueTemplateName(
  prisma: PrismaClient,
  creatorId: string,
  baseName: string,
): Promise<string> {
  const existing = await prisma.template.findMany({
    where: {
      creatorId,
      name: { startsWith: baseName },
    },
    select: { name: true },
  });

  const taken = new Set(existing.map((template) => template.name));
  if (!taken.has(baseName)) return baseName;

  let index = 2;
  while (taken.has(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}

export async function publishCollectionAsTemplate(
  prisma: PrismaClient,
  input: PublishCollectionAsTemplateInput,
): Promise<{ id: string; name: string; itemCount: number }> {
  const baseName = `${input.templatePrefix} ${input.templateSuffix}`.slice(0, 100);
  const templateName = await buildUniqueTemplateName(prisma, input.creatorId, baseName);

  const template = await prisma.template.create({
    data: {
      creatorId: input.creatorId,
      name: templateName,
      description: `Imported from ${input.sourcePage} on ${input.importedAtIso.slice(0, 10)}.`,
      isPublic: input.isPublic,
      items: {
        createMany: {
          data: input.items.map((item, index) => ({
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl ?? null,
            sourceNote: item.sourceNote ?? null,
            sortOrder: index,
          })),
        },
      },
    },
    select: {
      id: true,
      name: true,
      _count: { select: { items: true } },
    },
  });

  return { id: template.id, name: template.name, itemCount: template._count.items };
}

export function createPrismaClientFromEnv(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for --import-db");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export async function resolveImportCreatorId(
  prisma: PrismaClient,
  explicitCreatorId: string | null | undefined,
): Promise<string> {
  if (explicitCreatorId) {
    const creator = await prisma.user.findUnique({
      where: { id: explicitCreatorId },
      select: { id: true, nickname: true, role: true },
    });
    if (!creator) {
      throw new Error(`Creator user not found for id "${explicitCreatorId}".`);
    }
    return creator.id;
  }

  const configuredCreatorId = process.env.CONTENT_IMPORT_CREATOR_ID?.trim() ?? "";
  if (configuredCreatorId) {
    const creator = await prisma.user.findUnique({
      where: { id: configuredCreatorId },
      select: { id: true },
    });
    if (!creator) {
      throw new Error(
        `CONTENT_IMPORT_CREATOR_ID is set to "${configuredCreatorId}" but no matching user exists in this database.`,
      );
    }
    return creator.id;
  }

  const configuredNickname = process.env.CONTENT_IMPORT_CREATOR_NICKNAME?.trim() || "Host";
  const creators = await prisma.user.findMany({
    where: {
      nickname: configuredNickname,
      role: "ADMIN",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, nickname: true, role: true },
  });

  if (creators.length === 1) {
    return creators[0]?.id as string;
  }

  if (creators.length === 0) {
    throw new Error(
      `Could not resolve import creator automatically. No ADMIN user found with nickname "${configuredNickname}". Pass --creator-id, set CONTENT_IMPORT_CREATOR_ID, or set CONTENT_IMPORT_CREATOR_NICKNAME.`,
    );
  }

  throw new Error(
    `Found multiple ADMIN users with nickname "${configuredNickname}" (${creators
      .map((user) => user.id)
      .join(", ")}). Pass --creator-id or set CONTENT_IMPORT_CREATOR_ID.`,
  );
}
