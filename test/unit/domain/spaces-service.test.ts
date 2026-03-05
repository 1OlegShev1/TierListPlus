const mocks = vi.hoisted(() => ({
  resolveSpaceAccessContext: vi.fn(),
  prisma: {
    spaceMember: {
      findMany: vi.fn(),
    },
    template: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/domain/policy/resolvers", () => ({
  resolveSpaceAccessContext: mocks.resolveSpaceAccessContext,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { listSpaceMembers } from "@/domain/spaces/service";

describe("spaces service listSpaceMembers", () => {
  beforeEach(() => {
    mocks.resolveSpaceAccessContext.mockReset();
    mocks.prisma.spaceMember.findMany.mockReset();
    mocks.prisma.template.findMany.mockReset();
    mocks.prisma.template.create.mockReset();
  });

  it("blocks non-members from reading open-space members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    await expect(listSpaceMembers("space_1", null)).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "You must join this space first",
      }),
    );
    expect(mocks.prisma.spaceMember.findMany).not.toHaveBeenCalled();
  });

  it("keeps private spaces hidden for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Private Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    await expect(listSpaceMembers("space_1", null)).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "This space is private",
      }),
    );
    expect(mocks.prisma.spaceMember.findMany).not.toHaveBeenCalled();
  });

  it("returns members for joined users", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "MEMBER",
      isMember: true,
      isOwner: false,
    });
    mocks.prisma.spaceMember.findMany.mockResolvedValue([
      { id: "member_1", userId: "user_1", role: "MEMBER", createdAt: new Date() },
    ]);

    const result = await listSpaceMembers("space_1", "user_1");

    expect(result).toEqual({
      members: [expect.objectContaining({ id: "member_1", userId: "user_1", role: "MEMBER" })],
    });
    expect(mocks.prisma.spaceMember.findMany).toHaveBeenCalledTimes(1);
  });

  it("allows open-space template reads for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });
    mocks.prisma.template.findMany.mockResolvedValue([{ id: "template_1" }]);

    const { listSpaceTemplates } = await import("@/domain/spaces/service");
    const result = await listSpaceTemplates("space_1", null);

    expect(result).toEqual([expect.objectContaining({ id: "template_1" })]);
    expect(mocks.prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: "space_1", isHidden: false },
      }),
    );
  });

  it("blocks private-space template reads for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Private Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    const { listSpaceTemplates } = await import("@/domain/spaces/service");
    await expect(listSpaceTemplates("space_1", null)).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "This space is private",
      }),
    );
    expect(mocks.prisma.template.findMany).not.toHaveBeenCalled();
  });

  it("requires membership to create space templates", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    const { createSpaceTemplate } = await import("@/domain/spaces/service");
    await expect(
      createSpaceTemplate("space_1", "user_2", { name: "My list" }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "You must join this space first",
      }),
    );
    expect(mocks.prisma.template.create).not.toHaveBeenCalled();
  });

  it("lets members create space templates", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "MEMBER",
      isMember: true,
      isOwner: false,
    });
    mocks.prisma.template.create.mockResolvedValue({
      id: "template_2",
      spaceId: "space_1",
      creatorId: "user_2",
      name: "My list",
      isPublic: false,
    });

    const { createSpaceTemplate } = await import("@/domain/spaces/service");
    const result = await createSpaceTemplate("space_1", "user_2", { name: "My list" });

    expect(result).toEqual(expect.objectContaining({ id: "template_2", spaceId: "space_1" }));
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "My list",
        description: undefined,
        creatorId: "user_2",
        isPublic: false,
        spaceId: "space_1",
      },
    });
  });
});
