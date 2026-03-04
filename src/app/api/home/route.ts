import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { loadHomeData } from "@/lib/home-data";

export const GET = withHandler(async (request) => {
  const { userId } = await requireRequestAuth(request);
  return NextResponse.json(await loadHomeData(userId));
});
