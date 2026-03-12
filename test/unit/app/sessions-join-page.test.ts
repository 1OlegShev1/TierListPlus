const mocks = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  cookies: vi.fn(),
  headers: vi.fn(),
  getCookieAuth: vi.fn(),
  getSuggestedNicknameForUser: vi.fn(),
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    spaceMember: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}));

vi.mock("@/lib/auth", () => ({
  getCookieAuth: mocks.getCookieAuth,
}));

vi.mock("@/lib/nickname-suggestion", () => ({
  getSuggestedNicknameForUser: mocks.getSuggestedNicknameForUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import JoinVotePage, { generateMetadata } from "@/app/sessions/join/page";

describe("sessions join page", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.notFound.mockClear();
    mocks.cookies.mockReset().mockResolvedValue({} as never);
    mocks.headers.mockReset().mockResolvedValue({
      get(name: string) {
        if (name === "x-forwarded-host") return "example.test";
        if (name === "x-forwarded-proto") return "https";
        if (name === "host") return "example.test";
        return null;
      },
    });
    mocks.getCookieAuth.mockReset().mockResolvedValue(null);
    mocks.getSuggestedNicknameForUser.mockReset().mockResolvedValue(null);
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.spaceMember.findUnique.mockReset();
  });

  it("redirects closed shared links to results", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      status: "CLOSED",
    });

    await expect(
      JoinVotePage({
        searchParams: Promise.resolve({ code: "join1" }),
      }),
    ).rejects.toThrow("REDIRECT:/sessions/session_1/results?code=JOIN1");
  });

  it("keeps open shared links on join page", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      status: "OPEN",
      space: null,
    });

    const result = await JoinVotePage({
      searchParams: Promise.resolve({ code: "join1" }),
    });

    expect(result).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("loads nickname suggestion for signed-in viewers", async () => {
    mocks.getCookieAuth.mockResolvedValue({ userId: "user_1" });
    mocks.getSuggestedNicknameForUser.mockResolvedValue("Nick");
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      status: "OPEN",
      space: null,
    });

    const result = await JoinVotePage({
      searchParams: Promise.resolve({ code: "join1" }),
    });

    expect(result).toBeTruthy();
    expect(mocks.getSuggestedNicknameForUser).toHaveBeenCalledWith("user_1");
  });

  it("keeps closed private-space links on join page when invite is provided and viewer is not a member", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      status: "CLOSED",
      space: {
        id: "space_1",
        name: "Private Space",
        visibility: "PRIVATE",
      },
    });

    const result = await JoinVotePage({
      searchParams: Promise.resolve({ code: "join1", spaceInvite: "space1234" }),
    });

    expect(result).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("hides moderated-hidden sessions from outsiders", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      status: "OPEN",
      creatorId: "owner_1",
      isModeratedHidden: true,
      participants: [],
      space: null,
    });

    await expect(
      JoinVotePage({
        searchParams: Promise.resolve({ code: "join1" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("does not expose moderated-hidden session details in metadata", async () => {
    mocks.prisma.session.findUnique.mockResolvedValueOnce({
      name: "Secret Session",
      status: "OPEN",
      isModeratedHidden: true,
    });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ code: "join1" }),
    });

    expect(metadata.title).toBe("Join this vote | TierList+");
    expect(metadata.description).toBe("Open invite link for a collaborative tier list vote.");
    expect(metadata.openGraph?.title).toBe("Join this vote | TierList+");
  });
});
