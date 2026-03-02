import { NextResponse } from "next/server";
import { LINK_CODE_TTL_MS } from "@/lib/account-linking";
import { notFound, requireOwner, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRecoveryCode } from "@/lib/recovery-code";

export const POST = withHandler(async (request, { params }) => {
  const { userId } = await params;
  const { userId: requestUserId } = await requireRequestAuth(request);
  requireOwner(userId, requestUserId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) notFound("User not found");

  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);

  await prisma.linkCode.deleteMany({
    where: {
      userId,
      consumedAt: null,
    },
  });

  let code: string;
  let attempts = 0;
  while (true) {
    code = generateRecoveryCode();
    const existing = await prisma.linkCode.findUnique({ where: { code } });
    if (!existing) break;
    if (++attempts > 10) throw new Error("Could not generate unique recovery code");
  }

  await prisma.linkCode.create({
    data: {
      userId,
      code,
      expiresAt,
    },
  });

  return NextResponse.json({ linkCode: code, expiresAt });
});
