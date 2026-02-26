import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const POST = withHandler(async () => {
  const user = await prisma.user.create({ data: {} });
  return NextResponse.json({ id: user.id }, { status: 201 });
});
