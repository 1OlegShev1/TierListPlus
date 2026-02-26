import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod/v4";
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
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.details }, { status: error.status });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return NextResponse.json(
            { error: "A record with that value already exists" },
            { status: 409 },
          );
        }
        if (error.code === "P2025") {
          return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }
        if (error.code === "P2003") {
          return NextResponse.json({ error: "Referenced record not found" }, { status: 400 });
        }
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
    const flat = parsed.error.flatten();
    const messages = [
      ...flat.formErrors,
      ...Object.entries(flat.fieldErrors).map(
        ([field, errs]) => `${field}: ${(errs as string[]).join(", ")}`,
      ),
    ];
    throw new ApiError(400, messages.join("; ") || "Validation failed");
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

/** Shared Prisma include for bracket matchups with full item details + votes */
export const bracketMatchupInclude = {
  itemA: { select: { id: true, label: true, imageUrl: true } },
  itemB: { select: { id: true, label: true, imageUrl: true } },
  winner: { select: { id: true, label: true, imageUrl: true } },
  votes: { select: { participantId: true, chosenItemId: true } },
} as const;
