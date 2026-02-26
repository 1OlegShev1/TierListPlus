import { NextResponse } from "next/server";
import type { z } from "zod/v4";
import { prisma } from "@/lib/prisma";

/**
 * Parse request JSON body and validate against a Zod schema.
 * Returns the parsed data on success, or a 400 NextResponse on failure.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  return parsed.data;
}

/** Return a 404 JSON response */
export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Return a 400 JSON response */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Verify a participant belongs to a session.
 * Returns the participant record, or a 404 NextResponse if not found.
 */
export async function verifyParticipant(
  participantId: string,
  sessionId: string
) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, sessionId },
  });
  if (!participant) {
    return notFound("Participant not found in this session");
  }
  return participant;
}

/** Shared Prisma include for bracket matchups with full item details + votes */
export const bracketMatchupInclude = {
  itemA: { select: { id: true, label: true, imageUrl: true } },
  itemB: { select: { id: true, label: true, imageUrl: true } },
  winner: { select: { id: true, label: true, imageUrl: true } },
  votes: { select: { participantId: true, chosenItemId: true } },
} as const;
