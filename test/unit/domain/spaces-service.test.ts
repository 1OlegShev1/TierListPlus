const mocks = vi.hoisted(() => ({
  resolveSpaceAccessContext: vi.fn(),
  prisma: {
    spaceMember: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/domain/policy/resolvers", () => ({
  resolveSpaceAccessContext: mocks.resolveSpaceAccessContext,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { ApiError } from "@/lib/api-helpers";
import { listSpaceMembers } from "@/domain/spaces/service";

describe("spaces service listSpaceMembers", () => {
  beforeEach(() => {
    mocks.resolveSpaceAccessContext.mockReset();
    mocks.prisma.spaceMember.findMany.mockReset();
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
});
