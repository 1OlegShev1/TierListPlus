const mocks = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import JoinVotePage from "@/app/sessions/join/page";

describe("sessions join page", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.prisma.session.findUnique.mockReset();
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
    });

    const result = await JoinVotePage({
      searchParams: Promise.resolve({ code: "join1" }),
    });

    expect(result).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
