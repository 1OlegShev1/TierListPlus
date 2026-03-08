const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCookieAuth: vi.fn(),
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
    },
    tierVote: {
      findMany: vi.fn(),
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

vi.mock("@/app/sessions/[sessionId]/vote/VotePageClient", () => ({
  VotePageClient: () => null,
}));

vi.mock("@/app/sessions/[sessionId]/results/ResultsPageClient", () => ({
  ResultsPageClient: () => null,
}));

import ResultsPage from "@/app/sessions/[sessionId]/results/page";
import VotePage from "@/app/sessions/[sessionId]/vote/page";

describe("session page access guards", () => {
  beforeEach(() => {
    mocks.cookies.mockReset().mockResolvedValue({});
    mocks.getCookieAuth.mockReset().mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.participant.findFirst.mockReset();
    mocks.prisma.tierVote.findMany.mockReset().mockResolvedValue([]);
  });

  it("blocks private-space non-members on vote page", async () => {
    mocks.getCookieAuth.mockResolvedValue({ userId: "user_2" });
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Vote",
      joinCode: "JOIN1",
      status: "OPEN",
      creatorId: "owner_1",
      isPrivate: true,
      isLocked: false,
      tierConfig: [{ key: "S", label: "S", color: "#111111", sortOrder: 0 }],
      template: { isHidden: true },
      space: {
        creatorId: "owner_1",
        visibility: "PRIVATE",
        members: [],
      },
      items: [],
    });
    mocks.prisma.participant.findFirst.mockResolvedValue(null);

    await expect(
      VotePage({ params: Promise.resolve({ sessionId: "session_1" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("redirects open-space non-members into join flow from vote page", async () => {
    mocks.getCookieAuth.mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Vote",
      joinCode: "JOIN1",
      status: "OPEN",
      creatorId: "owner_1",
      isPrivate: true,
      isLocked: false,
      tierConfig: [{ key: "S", label: "S", color: "#111111", sortOrder: 0 }],
      template: { isHidden: true },
      space: {
        creatorId: "owner_1",
        visibility: "OPEN",
        members: [],
      },
      items: [],
    });

    await expect(
      VotePage({ params: Promise.resolve({ sessionId: "session_1" }) }),
    ).rejects.toThrow("REDIRECT:/sessions/join?code=JOIN1");
    expect(mocks.prisma.participant.findFirst).not.toHaveBeenCalled();
  });

  it("blocks private-space non-members on results page", async () => {
    mocks.getCookieAuth.mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Vote",
      joinCode: "JOIN1",
      status: "OPEN",
      creatorId: "owner_1",
      isPrivate: true,
      tierConfig: [{ key: "S", label: "S", color: "#111111", sortOrder: 0 }],
      space: {
        visibility: "PRIVATE",
        members: [],
      },
      items: [],
      participants: [],
    });

    await expect(
      ResultsPage({
        params: Promise.resolve({ sessionId: "session_1" }),
        searchParams: {},
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("allows open-space non-members on results page", async () => {
    mocks.getCookieAuth.mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Vote",
      joinCode: "JOIN1",
      status: "OPEN",
      creatorId: "owner_1",
      isPrivate: true,
      tierConfig: [{ key: "S", label: "S", color: "#111111", sortOrder: 0 }],
      space: {
        visibility: "OPEN",
        members: [],
      },
      items: [],
      participants: [],
    });

    const result = await ResultsPage({
      params: Promise.resolve({ sessionId: "session_1" }),
      searchParams: {},
    });

    expect(result).toBeTruthy();
    expect(mocks.prisma.tierVote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionItem: { sessionId: "session_1" } },
      }),
    );
  });

  it("allows private closed-session results via matching join code for outsiders", async () => {
    mocks.getCookieAuth.mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Private Vote",
      joinCode: "JOIN1",
      status: "CLOSED",
      creatorId: "owner_1",
      isPrivate: true,
      tierConfig: [{ key: "S", label: "S", color: "#111111", sortOrder: 0 }],
      space: null,
      items: [],
      participants: [
        {
          id: "participant_1",
          userId: "user_9",
          nickname: "TopSecretNick",
          submittedAt: null,
          _count: { tierVotes: 1 },
        },
      ],
    });

    const result = (await ResultsPage({
      params: Promise.resolve({ sessionId: "session_1" }),
      searchParams: { code: "JOIN1" },
    })) as unknown as { props: Record<string, unknown> };

    expect(result).toBeTruthy();
    expect(mocks.prisma.tierVote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionItem: { sessionId: "session_1" } },
      }),
    );
    expect(result.props.canViewIndividualBallots).toBe(false);
    expect(result.props.initialSession).toEqual(expect.objectContaining({ participants: [] }));
  });

  it("keeps private closed-session results hidden from outsiders without code", async () => {
    mocks.getCookieAuth.mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Private Vote",
      joinCode: "JOIN1",
      status: "CLOSED",
      creatorId: "owner_1",
      isPrivate: true,
      tierConfig: [{ key: "S", label: "S", color: "#111111", sortOrder: 0 }],
      space: null,
      items: [],
      participants: [],
    });

    await expect(
      ResultsPage({
        params: Promise.resolve({ sessionId: "session_1" }),
        searchParams: {},
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
