const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    template: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    participant: {
      create: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
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
    mocks.prisma.template.create.mockReset();
    mocks.prisma.participant.create.mockReset();
    mocks.prisma.user.updateMany.mockReset();
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
      expect.objectContaining({ where: { isPrivate: false, spaceId: null } }),
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
          spaceId: null,
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

  it("rejects missing and inaccessible templates, but allows empty ones", async () => {
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

    mocks.prisma.template.create.mockResolvedValueOnce(makeTemplate({ items: [] }));
    mocks.prisma.session.create.mockResolvedValueOnce(makeSession({ items: [] }));
    mocks.prisma.template.findUnique.mockResolvedValue(
      makeTemplate({ creatorId: "user_1", items: [] }),
    );
    response = await POST(
      jsonRequest("POST", "https://example.test", { templateId: "t1", name: "Session" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(201);
  });

  it("creates a blank session with its own hidden working template", async () => {
    mocks.prisma.template.create.mockResolvedValueOnce(
      makeTemplate({
        id: "working_template_blank",
        name: "Blank board",
        isHidden: true,
        items: [],
      }),
    );
    mocks.prisma.session.create.mockResolvedValueOnce(
      makeSession({
        id: "session_blank",
        name: "Blank board",
        templateId: "working_template_blank",
        sourceTemplateId: null,
        items: [],
      }),
    );

    const response = await POST(
      jsonRequest("POST", "https://example.test", { name: "Blank board" }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.template.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Blank board",
        description: null,
        creatorId: "user_1",
        isPublic: false,
        isHidden: true,
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
    expect(mocks.prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Blank board",
        templateId: "working_template_blank",
        sourceTemplateId: null,
        isPrivate: true,
        items: { create: [] },
      }),
      include: {
        items: true,
        _count: { select: { participants: true } },
      },
    });
  });

  it("trims the session name before persisting new sessions", async () => {
    mocks.prisma.template.create.mockResolvedValueOnce(
      makeTemplate({
        id: "working_template_trimmed",
        name: "Trimmed Name",
        isHidden: true,
        items: [],
      }),
    );
    mocks.prisma.session.create.mockResolvedValueOnce(
      makeSession({
        id: "session_trimmed",
        name: "Trimmed Name",
        templateId: "working_template_trimmed",
        sourceTemplateId: null,
        items: [],
      }),
    );

    const response = await POST(
      jsonRequest("POST", "https://example.test", { name: "  Trimmed Name  " }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Trimmed Name",
        description: null,
        creatorId: "user_1",
        isPublic: false,
        isHidden: true,
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
    expect(mocks.prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Trimmed Name",
      }),
      include: {
        items: true,
        _count: { select: { participants: true } },
      },
    });
  });

  it("creates a hidden working template from the chosen source template and tracks its origin", async () => {
    mocks.prisma.template.findUnique.mockResolvedValueOnce(
      makeTemplate({
        id: "template_source",
        name: "Starter pack",
        description: "Seeded",
        creatorId: "user_1",
        items: [
          makeSessionItem({ id: "source_1", label: "One", imageUrl: "/img/1.webp", sortOrder: 0 }),
          makeSessionItem({ id: "source_2", label: "Two", imageUrl: "/img/2.webp", sortOrder: 1 }),
        ],
      }),
    );
    mocks.prisma.template.create.mockResolvedValueOnce(
      makeTemplate({
        id: "working_template_seeded",
        name: "Starter pack",
        description: "Seeded",
        isHidden: true,
        items: [
          makeSessionItem({ id: "working_1", label: "One", imageUrl: "/img/1.webp", sortOrder: 0 }),
          makeSessionItem({ id: "working_2", label: "Two", imageUrl: "/img/2.webp", sortOrder: 1 }),
        ],
      }),
    );
    mocks.prisma.session.create.mockResolvedValueOnce(
      makeSession({
        id: "session_seeded",
        name: "Friday vote",
        templateId: "working_template_seeded",
        sourceTemplateId: "template_source",
      }),
    );

    const response = await POST(
      jsonRequest("POST", "https://example.test", {
        templateId: "template_source",
        name: "Friday vote",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Starter pack",
        description: "Seeded",
        creatorId: "user_1",
        isPublic: false,
        isHidden: true,
        items: {
          create: [
            { label: "One", imageUrl: "/img/1.webp", sortOrder: 0 },
            { label: "Two", imageUrl: "/img/2.webp", sortOrder: 1 },
          ],
        },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
    expect(mocks.prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Friday vote",
        templateId: "working_template_seeded",
        sourceTemplateId: "template_source",
        items: {
          create: [
            {
              templateItemId: "working_1",
              label: "One",
              imageUrl: "/img/1.webp",
              sortOrder: 0,
            },
            {
              templateItemId: "working_2",
              label: "Two",
              imageUrl: "/img/2.webp",
              sortOrder: 1,
            },
          ],
        },
      }),
      include: {
        items: true,
        _count: { select: { participants: true } },
      },
    });
  });

  it("retries join code collisions, defaults to private, and auto-joins with nickname", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue(
      makeTemplate({
        creatorId: "user_1",
        items: [makeSessionItem({ id: "i1" }), makeSessionItem({ id: "i2", sortOrder: 1 })],
      }),
    );
    mocks.prisma.template.create.mockResolvedValue(
      makeTemplate({
        id: "working_template_1",
        isHidden: true,
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
    mocks.prisma.user.updateMany.mockRejectedValueOnce(new Error("write failed"));

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
    expect(mocks.prisma.template.create).toHaveBeenCalledTimes(1);
  });
});
