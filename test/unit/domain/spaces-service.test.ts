const mocks = vi.hoisted(() => ({
  resolveSpaceAccessContext: vi.fn(),
  getTemplateForRead: vi.fn(),
  tryDeleteManagedUploadIfUnreferenced: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    space: {
      update: vi.fn(),
    },
    spaceMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    spaceInvite: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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

vi.mock("@/domain/templates/service", () => ({
  getTemplateForRead: mocks.getTemplateForRead,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/upload-gc", () => ({
  tryDeleteManagedUploadIfUnreferenced: mocks.tryDeleteManagedUploadIfUnreferenced,
}));

import { listSpaceMembers } from "@/domain/spaces/service";

describe("spaces service", () => {
  beforeEach(() => {
    mocks.resolveSpaceAccessContext.mockReset();
    mocks.getTemplateForRead.mockReset();
    mocks.tryDeleteManagedUploadIfUnreferenced.mockReset().mockResolvedValue(true);
    mocks.prisma.$transaction.mockReset();
    mocks.prisma.space.update.mockReset();
    mocks.prisma.spaceMember.findMany.mockReset();
    mocks.prisma.spaceMember.findUnique.mockReset();
    mocks.prisma.spaceMember.create.mockReset();
    mocks.prisma.spaceMember.delete.mockReset();
    mocks.prisma.spaceInvite.findFirst.mockReset();
    mocks.prisma.spaceInvite.findUnique.mockReset();
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

  it("copies an accessible personal/public list into the space for members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "MEMBER",
      isMember: true,
      isOwner: false,
    });
    mocks.getTemplateForRead.mockResolvedValue({
      id: "template_source",
      name: "Starter pack",
      description: "Top picks",
      isPublic: true,
      spaceId: null,
      items: [
        {
          label: "A",
          imageUrl: "/a.webp",
          sourceUrl: null,
          sourceProvider: null,
          sourceNote: null,
          sourceStartSec: null,
          sourceEndSec: null,
          sortOrder: 0,
        },
      ],
    });
    mocks.prisma.template.create.mockResolvedValue({
      id: "template_copy",
      spaceId: "space_1",
      creatorId: "user_2",
      name: "Starter pack",
      isPublic: false,
    });

    const { importTemplateIntoSpace } = await import("@/domain/spaces/service");
    const result = await importTemplateIntoSpace("space_1", "user_2", "template_source");

    expect(result).toEqual(expect.objectContaining({ id: "template_copy", spaceId: "space_1" }));
    expect(mocks.getTemplateForRead).toHaveBeenCalledWith("template_source", "user_2");
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Starter pack",
        description: "Top picks",
        creatorId: "user_2",
        isPublic: false,
        spaceId: "space_1",
        items: {
          create: [
            {
              label: "A",
              imageUrl: "/a.webp",
              sourceUrl: null,
              sourceProvider: null,
              sourceNote: null,
              sourceStartSec: null,
              sourceEndSec: null,
              sortOrder: 0,
            },
          ],
        },
      },
    });
  });

  it("rejects importing space-scoped lists into another space", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "MEMBER",
      isMember: true,
      isOwner: false,
    });
    mocks.getTemplateForRead.mockResolvedValue({
      id: "template_source",
      name: "Space source",
      description: null,
      isPublic: false,
      spaceId: "space_other",
      items: [],
    });

    const { importTemplateIntoSpace } = await import("@/domain/spaces/service");
    await expect(importTemplateIntoSpace("space_1", "user_2", "template_source")).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        details: "Only personal or public lists can be copied into a space",
      }),
    );
    expect(mocks.prisma.template.create).not.toHaveBeenCalled();
  });

  it("updates space customization and cleans up replaced logo", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Anime Space",
      description: "old",
      logoUrl: "/uploads/old-logo.webp",
      accentColor: "SLATE",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "OWNER",
      isMember: true,
      isOwner: true,
    });
    mocks.prisma.space.update.mockResolvedValue({
      id: "space_1",
      name: "Anime Space",
      description: null,
      logoUrl: "/uploads/new-logo.webp",
      accentColor: "SKY",
      visibility: "OPEN",
    });

    const { updateSpace } = await import("@/domain/spaces/service");
    const result = await updateSpace("space_1", "owner_1", {
      description: null,
      logoUrl: "/uploads/new-logo.webp",
      accentColor: "SKY",
    });

    expect(result).toEqual(
      expect.objectContaining({
        logoUrl: "/uploads/new-logo.webp",
        accentColor: "SKY",
      }),
    );
    expect(mocks.prisma.space.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "space_1" },
        data: expect.objectContaining({
          description: null,
          logoUrl: "/uploads/new-logo.webp",
          accentColor: "SKY",
        }),
      }),
    );
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/uploads/old-logo.webp",
      "space logo update",
    );
  });

  it("rejects invalid logo URLs even if service is called directly", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Anime Space",
      description: null,
      logoUrl: null,
      accentColor: "SLATE",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "OWNER",
      isMember: true,
      isOwner: true,
    });

    const { updateSpace } = await import("@/domain/spaces/service");
    await expect(
      updateSpace("space_1", "owner_1", { logoUrl: "https://bad.example/logo.webp" }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        details: "Invalid logo URL",
      }),
    );
    expect(mocks.prisma.space.update).not.toHaveBeenCalled();
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).not.toHaveBeenCalled();
  });

  it("blocks invite access for non-owners", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Private Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: "MEMBER",
      isMember: true,
      isOwner: false,
    });

    const { getPrivateSpaceInvite } = await import("@/domain/spaces/service");
    await expect(getPrivateSpaceInvite("space_1", "member_1")).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "Only the space owner can view space invites",
      }),
    );
    expect(mocks.prisma.spaceInvite.findFirst).not.toHaveBeenCalled();
  });

  it("blocks invite flow for open spaces", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open Space",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: "OWNER",
      isMember: true,
      isOwner: true,
    });

    const { getPrivateSpaceInvite } = await import("@/domain/spaces/service");
    await expect(getPrivateSpaceInvite("space_1", "owner_1")).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        details: "Invite codes are only used for private spaces",
      }),
    );
  });

  it("rotates private invite by revoking previous active codes", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Private Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: "OWNER",
      isMember: true,
      isOwner: true,
    });

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({
      code: "INVITE12345",
      expiresAt: new Date("2026-03-12T10:00:00.000Z"),
      createdAt: new Date("2026-03-05T10:00:00.000Z"),
    });
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        spaceInvite: {
          updateMany,
          findUnique,
          create,
        },
      }),
    );

    const { rotatePrivateSpaceInvite } = await import("@/domain/spaces/service");
    const result = await rotatePrivateSpaceInvite("space_1", "owner_1");

    expect(result).toEqual(
      expect.objectContaining({
        code: "INVITE12345",
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: "space_1", revokedAt: null },
      }),
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("prevents owner from leaving and allows regular member leave", async () => {
    mocks.prisma.spaceMember.findUnique
      .mockResolvedValueOnce({
        id: "membership_owner",
        role: "OWNER",
        space: { creatorId: "owner_1" },
      })
      .mockResolvedValueOnce({
        id: "membership_member",
        role: "MEMBER",
        space: { creatorId: "owner_1" },
      });

    const { leaveSpace } = await import("@/domain/spaces/service");
    await expect(leaveSpace("space_1", "owner_1")).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        details: "Space owner cannot leave the space",
      }),
    );

    await leaveSpace("space_1", "member_1");
    expect(mocks.prisma.spaceMember.delete).toHaveBeenCalledWith({
      where: { id: "membership_member" },
    });
  });

  it("enforces owner-only member removal and protects space owner", async () => {
    const { removeSpaceMember } = await import("@/domain/spaces/service");

    mocks.resolveSpaceAccessContext.mockResolvedValueOnce({
      id: "space_1",
      name: "Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: "MEMBER",
      isMember: true,
      isOwner: false,
    });

    await expect(removeSpaceMember("space_1", "member_1", "member_2")).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "Only the space owner can remove members",
      }),
    );

    mocks.resolveSpaceAccessContext.mockResolvedValueOnce({
      id: "space_1",
      name: "Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: "OWNER",
      isMember: true,
      isOwner: true,
    });
    await expect(removeSpaceMember("space_1", "owner_1", "owner_1")).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        details: "Space owner cannot be removed",
      }),
    );
  });

  it("removes target member when performed by owner", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Space",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: "OWNER",
      isMember: true,
      isOwner: true,
    });
    mocks.prisma.spaceMember.findUnique.mockResolvedValue({ id: "membership_target" });

    const { removeSpaceMember } = await import("@/domain/spaces/service");
    await removeSpaceMember("space_1", "owner_1", "member_2");

    expect(mocks.prisma.spaceMember.delete).toHaveBeenCalledWith({
      where: { id: "membership_target" },
    });
  });

  it("rejects invite joins when expectedSpaceId does not match before creating membership", async () => {
    mocks.prisma.spaceInvite.findUnique.mockResolvedValue({
      id: "invite_1",
      code: "ABC123",
      spaceId: "space_actual",
      revokedAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      space: {
        id: "space_actual",
        visibility: "PRIVATE",
      },
    });

    const { joinPrivateSpaceByInviteCode } = await import("@/domain/spaces/service");
    await expect(
      joinPrivateSpaceByInviteCode("user_1", "ABC123", "space_expected"),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        details: "This invite does not match the space for this ranking",
      }),
    );

    expect(mocks.prisma.spaceMember.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.spaceMember.create).not.toHaveBeenCalled();
  });
});
