import { NextResponse } from "next/server";
import { requireUserId, withHandler } from "@/lib/api-helpers";

export const GET = withHandler(async (request) => {
  const userId = requireUserId(request);
  return NextResponse.json({ id: userId });
});
