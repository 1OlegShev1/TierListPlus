const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    template: {
      findUnique: vi.fn(),
    },
    participant: {
      create: vi.fn(),
    },
  },
  getRequestAuth: vi.fn(),
  requireRequestAuth: vi.fn(),
  generateJoinCode: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
  requireRequestAuth: mocks.requireRequestAuth,
}));
vi.mock("@/lib/nanoid", () => ({
  generateJoinCode: mocks.generateJoinCode,
}));

import { GET, POST } from "@/app/api/sessions/route";
import { makeKnownRequestError, makeSession, makeSessionItem, makeTemplate } from "../../helpers/mocks";
import { jsonRequest } from "../../helpers/request";

describe("sessions collection route", () => {
  beforeEach(() => {
    mocks.prisma.session.findMany.mockReset();
    mocks.prisma.session.create.mockReset();
    mocks.prisma.template.findUnique.mockReset();
    mocks.prisma.participant.create.mockReset();
    mocks.getRequestAuth.mockReset().mockResolvedValue(null);
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
    mocks.generateJoinCode.mockReset().mockReturnValue("JOINCODE");
  });

  it("filters public sessions for anonymous users and rejects invalid status", async () => {
    mocks.prisma.session.findMany.mockResolvedValue([makeSession({ isPrivate: false })]);

    let response = await GET(new Request("https://example.test/api/sessions"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([expect.objectContaining({ isPrivate: false })]);
    expect(mocks.prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPrivate: false } }),
    );

    response = await GET(
      new Request("https://example.test/api/sessions?status=BAD"),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid status filter. Must be OPEN, CLOSED, or ARCHIVED",
    });
  });

  it("includes owned and participated sessions for authenticated users", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "user_1" });
    mocks.prisma.session.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request("https://example.test/api/sessions?status=OPEN"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "OPEN",
          OR: [
            { creatorId: "user_1" },
            { participants: { some: { userId: "user_1" } } },
            { isPrivate: false },
          ],
        },
      }),
    );
  });

  it("rejects missing, inaccessible, and empty templates", async () => {
    let response = await POST(
      jsonRequest("POST", "https://example.test", { templateId: "t1", name: "Session" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(404);

    mocks.prisma.template.findUnique.mockResolvedValue(makeTemplate({ creatorId: "user_2" }));
    response = await POST(
      jsonRequest("POST", "https://example.test", { templateId: "t1", name: "Session" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(404);

    mocks.prisma.template.findUnique.mockResolvedValue(
      makeTemplate({ creatorId: "user_1", items: [] }),
    );
    response = await POST(
      jsonRequest("POST", "https://example.test", { templateId: "t1", name: "Session" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Template has no items" });
  });

  it("retries join code collisions, defaults to private, and auto-joins with nickname", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue(
      makeTemplate({
        creatorId: "user_1",
        items: [makeSessionItem({ id: "i1" }), makeSessionItem({ id: "i2", sortOrder: 1 })],
      }),
    );
    mocks.prisma.session.create
      .mockRejectedValueOnce(makeKnownRequestError("P2002", ["joinCode"]))
      .mockResolvedValueOnce(makeSession());
    mocks.prisma.participant.create.mockResolvedValue({
      id: "participant_1",
      nickname: "Host",
    });

    const response = await POST(
      jsonRequest("POST", "https://example.test", {
        templateId: "t1",
        name: "Session",
        nickname: "Host",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        isPrivate: true,
        participantId: "participant_1",
        participantNickname: "Host",
      }),
    );
    expect(mocks.prisma.session.create).toHaveBeenCalledTimes(2);
  });
});
