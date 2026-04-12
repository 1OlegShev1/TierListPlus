const mocks = vi.hoisted(() => ({
  getRequestAuth: vi.fn(),
  resolveSpaceAccessContext: vi.fn(),
  resolveSessionAccessContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
}));

vi.mock("@/domain/policy/resolvers", () => ({
  resolveSpaceAccessContext: mocks.resolveSpaceAccessContext,
  resolveSessionAccessContext: mocks.resolveSessionAccessContext,
}));

import { requireSessionAccess, resolveSpaceAccess } from "@/lib/api-helpers";

describe("api helpers space/session access", () => {
  beforeEach(() => {
    mocks.getRequestAuth.mockReset().mockResolvedValue(null);
    mocks.resolveSpaceAccessContext.mockReset();
    mocks.resolveSessionAccessContext.mockReset();
  });

  it("blocks private space access for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Private",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    await expect(
      resolveSpaceAccess(new Request("https://example.test"), "space_1"),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "This space is private",
      }),
    );
  });

  it("allows open space access for non-members", async () => {
    mocks.resolveSpaceAccessContext.mockResolvedValue({
      id: "space_1",
      name: "Open",
      visibility: "OPEN",
      creatorId: "owner_1",
      memberRole: null,
      isMember: false,
      isOwner: false,
    });

    const access = await resolveSpaceAccess(new Request("https://example.test"), "space_1");

    expect(access).toEqual(
      expect.objectContaining({
        requestUserId: null,
        isMember: false,
        isOwner: false,
      }),
    );
  });

  it("blocks private space sessions for non-members", async () => {
    mocks.resolveSessionAccessContext.mockResolvedValue({
      id: "session_1",
      creatorId: "creator_1",
      isPrivate: true,
      spaceId: "space_1",
      spaceVisibility: "PRIVATE",
      spaceCreatorId: "owner_1",
      memberRole: null,
      isSpaceMember: false,
      isSpaceOwner: false,
      isOwner: false,
      isParticipant: false,
    });

    await expect(
      requireSessionAccess(new Request("https://example.test"), "session_1"),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "This session is private to space members",
      }),
    );
  });

  it("allows open space sessions for non-members", async () => {
    mocks.resolveSessionAccessContext.mockResolvedValue({
      id: "session_1",
      creatorId: "creator_1",
      isPrivate: true,
      spaceId: "space_1",
      spaceVisibility: "OPEN",
      spaceCreatorId: "owner_1",
      memberRole: null,
      isSpaceMember: false,
      isSpaceOwner: false,
      isOwner: false,
      isParticipant: false,
    });

    const access = await requireSessionAccess(new Request("https://example.test"), "session_1");

    expect(access).toEqual(
      expect.objectContaining({
        requestUserId: null,
        isSpaceMember: false,
      }),
    );
  });

  it("applies personal private session rules", async () => {
    mocks.resolveSessionAccessContext.mockResolvedValueOnce({
      id: "session_1",
      creatorId: "creator_1",
      isPrivate: true,
      spaceId: null,
      spaceVisibility: null,
      spaceCreatorId: null,
      memberRole: null,
      isSpaceMember: false,
      isSpaceOwner: false,
      isOwner: false,
      isParticipant: false,
    });

    await expect(
      requireSessionAccess(new Request("https://example.test"), "session_1"),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 403,
        details: "This session is private",
      }),
    );

    mocks.resolveSessionAccessContext.mockResolvedValueOnce({
      id: "session_1",
      creatorId: "creator_1",
      isPrivate: true,
      spaceId: null,
      spaceVisibility: null,
      spaceCreatorId: null,
      memberRole: null,
      isSpaceMember: false,
      isSpaceOwner: false,
      isOwner: false,
      isParticipant: true,
    });

    const access = await requireSessionAccess(new Request("https://example.test"), "session_1");
    expect(access.isParticipant).toBe(true);
  });
});
