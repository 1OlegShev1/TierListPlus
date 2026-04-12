import type { DraftKind, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const draftKindSchema = z.enum(["LIST_EDITOR"]);
const draftScopeSchema = z.string().trim().min(1).max(160);
const MAX_DRAFT_PAYLOAD_BYTES = 256 * 1024;
const MAX_LIST_ITEMS_PER_DRAFT = 500;

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

const putDraftSchema = z.object({
  kind: draftKindSchema,
  scope: draftScopeSchema,
  payload: z.unknown(),
});

function parseDraftQuery(request: Request): { kind: DraftKind; scope: string } {
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

function validateDraftPayload(kind: DraftKind, payload: unknown): Prisma.InputJsonValue {
  let parsedPayload: unknown;

  if (kind === "LIST_EDITOR") {
    const parsed = listEditorDraftPayloadSchema.safeParse(payload);
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
  const draft = await prisma.draft.findUnique({
    where: {
      userId_kind_scope: {
        userId: auth.userId,
        kind,
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
  const validatedPayload = validateDraftPayload(kind, payload);
  const draft = await prisma.draft.upsert({
    where: {
      userId_kind_scope: {
        userId: auth.userId,
        kind,
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
      kind,
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
  await prisma.draft.deleteMany({
    where: {
      userId: auth.userId,
      kind,
      scope,
    },
  });
  return new Response(null, { status: 204 });
});
