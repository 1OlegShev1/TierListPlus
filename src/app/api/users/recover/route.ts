import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const recoverSchema = z.object({
  recoveryCode: z.string().min(1),
});

export const POST = withHandler(async (request) => {
  const { recoveryCode } = await validateBody(request, recoverSchema);

  const user = await prisma.user.findUnique({
    where: { recoveryCode: recoveryCode.toUpperCase() },
    select: { id: true },
  });

  if (!user) notFound("No account found with that recovery code");

  return NextResponse.json({ userId: user.id });
});
