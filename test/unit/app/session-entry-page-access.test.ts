const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCookieAuth: vi.fn(),
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      count: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (target: string) => {
    throw new Error(`REDIRECT:${target}`);
  },
}));

vi.mock("@/lib/auth", () => ({
  getCookieAuth: mocks.getCookieAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import VoteEntryPage from "@/app/sessions/[sessionId]/page";

describe("session entry page access", () => {
  beforeEach(() => {
    mocks.cookies.mockReset().mockResolvedValue({});
    mocks.getCookieAuth.mockReset().mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.participant.count.mockReset().mockResolvedValue(0);
  });

  it("blocks outsider access when session is moderated hidden", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      joinCode: "JOIN1",
      status: "OPEN",
      creatorId: "owner_1",
      isPrivate: false,
      isModeratedHidden: true,
      space: null,
    });

    await expect(
      VoteEntryPage({ params: Promise.resolve({ sessionId: "session_1" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("allows existing participant access for moderated-hidden sessions", async () => {
    mocks.getCookieAuth.mockResolvedValue({ userId: "user_2" });
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      joinCode: "JOIN1",
      status: "OPEN",
      creatorId: "owner_1",
      isPrivate: false,
      isModeratedHidden: true,
      space: null,
    });
    mocks.prisma.participant.count.mockResolvedValue(1);

    await expect(
      VoteEntryPage({ params: Promise.resolve({ sessionId: "session_1" }) }),
    ).rejects.toThrow("REDIRECT:/sessions/session_1/vote");
  });
});
