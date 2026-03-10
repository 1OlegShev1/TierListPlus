const mocks = vi.hoisted(() => ({
  resolveSpaceAccessContext: vi.fn(),
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
}));

vi.mock("@/domain/policy/resolvers", () => ({
  resolveSpaceAccessContext: mocks.resolveSpaceAccessContext,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/nanoid", () => ({
  generateJoinCode: vi.fn(() => "JOINCODE"),
}));

import {
  assertValidSessionStatus,
  createSession,
  listSpaceSessions,
} from "@/domain/sessions/service";

describe("sessions service", () => {
  beforeEach(() => {
    mocks.resolveSpaceAccessContext.mockReset();
    mocks.prisma.session.findMany.mockReset();
    mocks.prisma.session.create.mockReset();
    mocks.prisma.template.findUnique.mockReset();
    mocks.prisma.template.create.mockReset();
    mocks.prisma.participant.create.mockReset();
    mocks.prisma.user.updateMany.mockReset();
  });

  it("blocks private-space session reads for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Private",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    await expect(listSpaceSessions("space_1", null, null)).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "This space is private",
      }),
    );
    expect(mocks.prisma.session.findMany).not.toHaveBeenCalled();
  });

  it("allows open-space session reads for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });
    mocks.prisma.session.findMany.mockResolvedValue([{ id: "session_1" }]);

    const result = await listSpaceSessions("space_1", null, "OPEN");

    expect(result).toEqual([expect.objectContaining({ id: "session_1" })]);
    expect(mocks.prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: "space_1", status: "OPEN" },
      }),
    );
  });

  it("validates status filter", () => {
    expect(() => assertValidSessionStatus("OPEN")).not.toThrow();
    expect(() => assertValidSessionStatus(null)).not.toThrow();
    expect(() => assertValidSessionStatus("BAD")).toThrow(
      expect.objectContaining({
        status: 400,
        details: "Invalid status filter. Must be OPEN, CLOSED, or ARCHIVED",
      }),
    );
  });

  it("rejects creating space session from template outside the space", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({
      id: "template_1",
      name: "Template",
      description: null,
      creatorId: "user_1",
      isPublic: false,
      isHidden: false,
      spaceId: "other_space",
      items: [],
    });

    await expect(
      createSession({
        creatorId: "user_1",
        name: "Vote",
        templateId: "template_1",
        spaceId: "space_1",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 404,
        details: "Template not found",
      }),
    );
  });

  it("allows creating space session from accessible global template", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({
      id: "template_1",
      name: "Public Template",
      description: "desc",
      creatorId: "other_user",
      isPublic: true,
      isHidden: false,
      spaceId: null,
      items: [],
    });
    mocks.prisma.template.create.mockResolvedValue({
      id: "working_template",
      items: [],
    });
    mocks.prisma.session.create.mockResolvedValue({
      id: "session_1",
      name: "Vote",
      templateId: "working_template",
      sourceTemplateId: "template_1",
      joinCode: "JOINCODE",
      creatorId: "user_1",
      tierConfig: {},
      isPrivate: true,
      items: [],
      _count: { participants: 0 },
    });

    const created = await createSession({
      creatorId: "user_1",
      name: "Vote",
      templateId: "template_1",
      spaceId: "space_1",
    });

    expect(created).toEqual(expect.objectContaining({ id: "session_1" }));
    expect(mocks.prisma.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spaceId: "space_1",
        }),
      }),
    );
    expect(mocks.prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceTemplateId: "template_1",
          isPrivate: true,
          spaceId: "space_1",
        }),
      }),
    );
  });
});
