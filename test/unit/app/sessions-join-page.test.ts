const mocks = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  cookies: vi.fn(),
  getCookieAuth: vi.fn(),
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
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth", () => ({
  getCookieAuth: mocks.getCookieAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import JoinVotePage from "@/app/sessions/join/page";

describe("sessions join page", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.cookies.mockReset().mockResolvedValue({} as never);
    mocks.getCookieAuth.mockReset().mockResolvedValue(null);
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
});
