import { NextResponse } from "next/server";
import { notFound, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { generateRecoveryCode } from "@/lib/recovery-code";

export const POST = withHandler(async (_request, { params }) => {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, recoveryCode: true },
  });
  if (!user) notFound("User not found");

  // Return existing code if already generated
  if (user.recoveryCode) {
    return NextResponse.json({ recoveryCode: user.recoveryCode });
  }

  // Generate a unique code with retry
  let code: string;
  let attempts = 0;
  while (true) {
    code = generateRecoveryCode();
    const existing = await prisma.user.findUnique({ where: { recoveryCode: code } });
    if (!existing) break;
    if (++attempts > 10) throw new Error("Could not generate unique recovery code");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { recoveryCode: code },
  });

  return NextResponse.json({ recoveryCode: code });
});
