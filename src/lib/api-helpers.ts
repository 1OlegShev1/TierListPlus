import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod/v4";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Structured error for API routes. Thrown by helpers, caught by withHandler. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public details: string,
  ) {
    super(details);
  }
}

export function formatZodError(error: z.ZodError): string {
  const flat = error.flatten();
  const messages = [
    ...flat.formErrors,
    ...Object.entries(flat.fieldErrors).map(
      ([field, errs]) => `${field}: ${(errs as string[]).join(", ")}`,
    ),
  ];
  return messages.join("; ") || "Validation failed";
}

export function mapApiError(error: unknown): { status: number; body: { error: string } } | null {
  if (
    error instanceof ApiError ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "details" in error &&
      typeof error.status === "number" &&
      typeof error.details === "string")
  ) {
    const status = error instanceof ApiError ? error.status : (error as { status: number }).status;
    const details =
      error instanceof ApiError ? error.details : (error as { details: string }).details;
    return { status, body: { error: details } };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        status: 409,
        body: { error: "A record with that value already exists" },
      };
    }
    if (error.code === "P2025") {
      return {
        status: 404,
        body: { error: "Record not found" },
      };
    }
    if (error.code === "P2003") {
      return {
        status: 400,
        body: { error: "Referenced record not found" },
      };
    }
  }
  return null;
}

/**
 * Wraps an API route handler with try/catch.
 * Catches ApiError for structured 4xx responses, Prisma errors for common DB issues,
 * and logs + returns 500 for unexpected errors.
 */
export function withHandler(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      const mapped = mapApiError(error);
      if (mapped) {
        return NextResponse.json(mapped.body, { status: mapped.status });
      }
      console.error("Unhandled API error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/**
 * Parse request JSON body and validate against a Zod schema.
 * Throws ApiError on malformed JSON or validation failure.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, formatZodError(parsed.error));
  }
  return parsed.data;
}

/** Throw a 404 ApiError */
export function notFound(message: string): never {
  throw new ApiError(404, message);
}

/** Throw a 400 ApiError */
export function badRequest(message: string): never {
  throw new ApiError(400, message);
}

/** Throw a 403 ApiError */
export function forbidden(message = "Not authorized"): never {
  throw new ApiError(403, message);
}

/** Verify the requesting user owns a resource. Throws 403 if not. */
export function requireOwner(creatorId: string | null, requestUserId: string | null) {
  if (!creatorId || !requestUserId || creatorId !== requestUserId) {
    forbidden("You are not the owner of this resource");
  }
}

/**
 * Verify a participant belongs to a session.
 * Returns the participant record, or throws 404 if not found.
 */
export async function verifyParticipant(participantId: string, sessionId: string) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, sessionId },
  });
  if (!participant) {
    notFound("Participant not found in this session");
  }
  return participant;
}

/**
 * Require that the current signed-in user owns the given participant identity.
 * For legacy rows with null userId, atomically binds the participant to the current user.
 */
export async function requireParticipantOwner(
  request: Request,
  participantId: string,
  sessionId: string,
) {
  const { userId: requestUserId } = await requireRequestAuth(request);
  const participant = await verifyParticipant(participantId, sessionId);

  if (participant.userId === requestUserId) {
    return participant;
  }

  if (!participant.userId) {
    const existingParticipant = await prisma.participant.findFirst({
      where: { sessionId, userId: requestUserId },
      orderBy: { createdAt: "asc" },
    });
    if (existingParticipant) {
      return existingParticipant;
    }

    const { count } = await prisma.participant.updateMany({
      where: { id: participant.id, sessionId, userId: null },
      data: { userId: requestUserId },
    });
    if (count === 1) {
      return { ...participant, userId: requestUserId };
    }
    const rebound = await verifyParticipant(participantId, sessionId);
    if (rebound.userId === requestUserId) return rebound;
  }

  forbidden("You are not allowed to submit or view votes for this participant");
}

/**
 * Verify a session exists and is OPEN.
 * Returns the session, or throws 404/409 if not found or closed.
 */
export async function requireOpenSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });
  if (!session) notFound("Session not found");
  if (session.status !== "OPEN") {
    throw new ApiError(409, "Session is not accepting votes");
  }
  return session;
}

/**
 * Require access to a session.
 * Private sessions are visible only to the creator or joined participants.
 */
export async function requireSessionAccess(request: Request, sessionId: string) {
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      creatorId: true,
      isPrivate: true,
      participants: requestUserId
        ? {
            where: { userId: requestUserId },
            select: { id: true },
            take: 1,
          }
        : false,
    },
  });
  if (!session) notFound("Session not found");

  const isOwner = !!requestUserId && session.creatorId === requestUserId;
  const isParticipant =
    !!requestUserId && Array.isArray(session.participants) && session.participants.length > 0;

  if (session.isPrivate && !isOwner && !isParticipant) {
    forbidden("This session is private");
  }

  return { session, requestUserId, isOwner, isParticipant, auth };
}

/** Require that the current signed-in user owns the session. */
export async function requireSessionOwner(request: Request, sessionId: string) {
  const { session, requestUserId } = await requireSessionAccess(request, sessionId);
  requireOwner(session.creatorId, requestUserId);
  return { session, requestUserId };
}

/** Central policy for whether a signed-in user may add/remove/rename session items. */
export function canManageSessionItems(
  templateIsHidden: boolean,
  creatorId: string | null,
  requestUserId: string | null,
) {
  return !!templateIsHidden && !!requestUserId && creatorId === requestUserId;
}

/** Require that the current signed-in user may manage session items for a session. */
export async function requireSessionItemManager(
  request: Request,
  sessionId: string,
  options?: { includeTemplateId?: boolean },
) {
  const { userId: requestUserId } = await requireRequestAuth(request);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      creatorId: true,
      templateId: options?.includeTemplateId ?? false,
      template: { select: { isHidden: true } },
    },
  });

  if (!session) notFound("Session not found");
  if (!canManageSessionItems(session.template.isHidden, session.creatorId, requestUserId)) {
    requireOwner(session.creatorId, requestUserId);
    badRequest("This session must be recreated before live item editing is available");
  }

  return { session, requestUserId };
}

/** Shared Prisma include for bracket matchups with full item details + votes */
export const bracketMatchupInclude = {
  itemA: { select: { id: true, label: true, imageUrl: true } },
  itemB: { select: { id: true, label: true, imageUrl: true } },
  winner: { select: { id: true, label: true, imageUrl: true } },
  votes: { select: { participantId: true, chosenItemId: true } },
} as const;
