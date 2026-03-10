import { prisma } from "@/lib/prisma";

function normalizeNickname(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function getSuggestedNicknameForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true },
  });
  return normalizeNickname(user?.nickname);
}
