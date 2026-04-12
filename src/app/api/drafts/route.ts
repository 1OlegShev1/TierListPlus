import type { DraftKind, Prisma } from "@prisma/client";
import { DraftKind as PrismaDraftKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const draftKindSchema = z.enum(["LIST_EDITOR", "VOTE_BOARD"]);
type DraftApiKind = z.infer<typeof draftKindSchema>;
const draftScopeSchema = z.string().trim().min(1).max(160);
const MAX_DRAFT_PAYLOAD_BYTES = 256 * 1024;
const MAX_LIST_ITEMS_PER_DRAFT = 500;
const MAX_VOTE_ITEMS_PER_DRAFT = 500;
const MAX_VOTE_TIERS_PER_DRAFT = 24;

const listEditorDraftItemSchema = z
  .object({
    id: z.string().trim().min(1).max(191).optional(),
    label: z.string().max(100),
    imageUrl: z.string().trim().min(1).max(2048),
    sourceUrl: z.string().trim().min(1).max(2048).nullable().optional(),
    sourceProvider: z.enum(["SPOTIFY", "YOUTUBE"]).nullable().optional(),
    sourceNote: z.string().trim().max(120).nullable().optional(),
    sourceStartSec: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
    sourceEndSec: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
    sortOrder: z.number().int().min(0),
  })
  .strict();

const listEditorDraftPayloadSchema = z
  .object({
    version: z.literal(1),
    updatedAtMs: z.number().int().positive(),
    name: z.string().max(100),
    description: z.string().max(500),
    isPublic: z.boolean(),
    items: z.array(listEditorDraftItemSchema).max(MAX_LIST_ITEMS_PER_DRAFT),
  })
  .strict();

const voteItemIdSchema = z.string().trim().min(1).max(191);

const voteBoardDraftPayloadSchema = z
  .object({
    version: z.literal(1),
    updatedAtMs: z.number().int().positive(),
    tiers: z.record(
      voteItemIdSchema.max(64),
      z.array(voteItemIdSchema).max(MAX_VOTE_ITEMS_PER_DRAFT),
    ),
    unranked: z.array(voteItemIdSchema).max(MAX_VOTE_ITEMS_PER_DRAFT),
  })
  .strict()
  .superRefine((payload, ctx) => {
    const tierCount = Object.keys(payload.tiers).length;
    if (tierCount > MAX_VOTE_TIERS_PER_DRAFT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Too many tiers in vote draft payload",
      });
    }

    const seen = new Set<string>();
    let totalItems = 0;
    for (const ids of Object.values(payload.tiers)) {
      totalItems += ids.length;
      for (const id of ids) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Vote draft payload cannot contain duplicate item IDs",
          });
          return;
        }
        seen.add(id);
      }
    }

    totalItems += payload.unranked.length;
    for (const id of payload.unranked) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vote draft payload cannot contain duplicate item IDs",
        });
        return;
      }
      seen.add(id);
    }

    if (totalItems > MAX_VOTE_ITEMS_PER_DRAFT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vote draft payload has too many items",
      });
    }
  });

const putDraftSchema = z.object({
  kind: draftKindSchema,
  scope: draftScopeSchema,
  payload: z.unknown(),
});

function parseDraftQuery(request: Request): { kind: DraftApiKind; scope: string } {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const scope = searchParams.get("scope");
  const parsedKind = draftKindSchema.safeParse(kind);
  const parsedScope = draftScopeSchema.safeParse(scope);
  if (!parsedKind.success || !parsedScope.success) {
    badRequest("Query requires valid kind and scope");
  }
  return { kind: parsedKind.data, scope: parsedScope.data };
}

function toPrismaDraftKind(kind: DraftApiKind): DraftKind {
  const knownPrismaKinds = Object.values(PrismaDraftKind) as string[];
  if (!knownPrismaKinds.includes(kind)) {
    badRequest("Unsupported draft kind");
  }
  return kind as DraftKind;
}

function toDraftResponse(draft: {
  kind: DraftKind;
  scope: string;
  payload: Prisma.JsonValue;
  updatedAt: Date;
}) {
  return {
    kind: draft.kind,
    scope: draft.scope,
    payload: draft.payload,
    updatedAtMs: draft.updatedAt.getTime(),
  };
}

function validateDraftPayload(kind: DraftApiKind, payload: unknown): Prisma.InputJsonValue {
  let parsedPayload: unknown;

  if (kind === "LIST_EDITOR") {
    const parsed = listEditorDraftPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      badRequest("Payload is invalid for the requested draft kind");
    }
    parsedPayload = parsed.data;
  } else if (kind === "VOTE_BOARD") {
    const parsed = voteBoardDraftPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      badRequest("Payload is invalid for the requested draft kind");
    }
    parsedPayload = parsed.data;
  } else {
    badRequest("Unsupported draft kind");
  }

  const payloadBytes = new TextEncoder().encode(JSON.stringify(parsedPayload)).length;
  if (payloadBytes > MAX_DRAFT_PAYLOAD_BYTES) {
    badRequest("Draft payload is too large");
  }

  return parsedPayload as Prisma.InputJsonValue;
}

export const GET = withHandler(async (request) => {
  const auth = await requireRequestAuth(request);
  const { kind, scope } = parseDraftQuery(request);
  const prismaKind = toPrismaDraftKind(kind);
  const draft = await prisma.draft.findUnique({
    where: {
      userId_kind_scope: {
        userId: auth.userId,
        kind: prismaKind,
        scope,
      },
    },
    select: {
      kind: true,
      scope: true,
      payload: true,
      updatedAt: true,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json(toDraftResponse(draft));
});

export const PUT = withHandler(async (request) => {
  const auth = await requireRequestAuth(request);
  const { kind, scope, payload } = await validateBody(request, putDraftSchema);
  const prismaKind = toPrismaDraftKind(kind);
  const validatedPayload = validateDraftPayload(kind, payload);
  const draft = await prisma.draft.upsert({
    where: {
      userId_kind_scope: {
        userId: auth.userId,
        kind: prismaKind,
        scope,
      },
    },
    update: {
      payload: validatedPayload,
      deviceId: auth.deviceId,
    },
    create: {
      userId: auth.userId,
      deviceId: auth.deviceId,
      kind: prismaKind,
      scope,
      payload: validatedPayload,
    },
    select: {
      kind: true,
      scope: true,
      payload: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(toDraftResponse(draft));
});

export const DELETE = withHandler(async (request) => {
  const auth = await requireRequestAuth(request);
  const { kind, scope } = parseDraftQuery(request);
  const prismaKind = toPrismaDraftKind(kind);
  await prisma.draft.deleteMany({
    where: {
      userId: auth.userId,
      kind: prismaKind,
      scope,
    },
  });
  return new Response(null, { status: 204 });
});
