const mocks = vi.hoisted(() => ({
  prisma: {
    template: {
      findMany: vi.fn(),
    },
    session: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { GET } from "@/app/api/home/route";
import { makeSession, makeTemplate } from "../../helpers/mocks";

describe("home route", () => {
  beforeEach(() => {
    mocks.prisma.template.findMany.mockReset().mockResolvedValue([makeTemplate()]);
    mocks.prisma.session.count.mockReset().mockResolvedValue(1);
    mocks.prisma.session.findMany
      .mockReset()
      .mockResolvedValueOnce([makeSession({ id: "session_started" })])
      .mockResolvedValueOnce([makeSession({ id: "session_joined", creatorId: "user_2" })])
      .mockResolvedValueOnce([makeSession({ id: "session_from_template", creatorId: "user_2" })]);
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
  });

  it("keeps the home vote sections limited to open sessions", async () => {
    const response = await GET(new Request("https://example.test/api/home"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        mySessions: [expect.objectContaining({ id: "session_started" })],
        participatedSessions: [expect.objectContaining({ id: "session_joined" })],
        fromMyTemplates: [expect.objectContaining({ id: "session_from_template" })],
      }),
    );

    expect(mocks.prisma.session.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: "user_1",
          status: "OPEN",
        }),
      }),
    );
    expect(mocks.prisma.session.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          participants: { some: { userId: "user_1" } },
        }),
      }),
    );
    expect(mocks.prisma.session.findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          creatorId: { not: "user_1" },
          isPrivate: false,
          sourceTemplate: {
            creatorId: "user_1",
            isHidden: false,
          },
        }),
      }),
    );
  });
});
