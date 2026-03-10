import { getSuggestedNicknameForUser } from "@/lib/nickname-suggestion";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

describe("getSuggestedNicknameForUser", () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockReset();
  });

  it("returns null when user is missing", async () => {
    const nickname = await getSuggestedNicknameForUser(null);

    expect(nickname).toBeNull();
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("uses persisted user nickname when available", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ nickname: "  Alex  " });

    const nickname = await getSuggestedNicknameForUser("user_1");

    expect(nickname).toBe("Alex");
  });

  it("returns null when persisted user nickname is empty", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ nickname: "   " });

    const nickname = await getSuggestedNicknameForUser("user_1");

    expect(nickname).toBeNull();
  });
});
