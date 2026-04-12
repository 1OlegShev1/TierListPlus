const mocks = vi.hoisted(() => ({
  getRequestAuth: vi.fn(),
  requireRequestAuth: vi.fn(),
  spacesService: {
    listSpacesForUser: vi.fn(),
    createSpace: vi.fn(),
    getSpaceDetails: vi.fn(),
    updateSpace: vi.fn(),
    getPrivateSpaceInvite: vi.fn(),
    rotatePrivateSpaceInvite: vi.fn(),
    joinPrivateSpaceByInviteCode: vi.fn(),
    listSpaceMembers: vi.fn(),
    joinOpenSpace: vi.fn(),
    leaveSpace: vi.fn(),
    removeSpaceMember: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
  requireRequestAuth: mocks.requireRequestAuth,
}));

vi.mock("@/domain/spaces/service", () => mocks.spacesService);

import { GET as getInvite, POST as postInvite } from "@/app/api/spaces/[spaceId]/invite/route";
import { DELETE as removeMember } from "@/app/api/spaces/[spaceId]/members/[userId]/route";
import { DELETE as leaveSpace } from "@/app/api/spaces/[spaceId]/members/me/route";
import { GET as getMembers, POST as postMembers } from "@/app/api/spaces/[spaceId]/members/route";
import { GET as getSpace, PATCH as patchSpace } from "@/app/api/spaces/[spaceId]/route";
import { POST as joinByCode } from "@/app/api/spaces/join/route";
import { GET, POST } from "@/app/api/spaces/route";
import { ApiError } from "@/lib/api-helpers";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("spaces api routes", () => {
  beforeEach(() => {
    mocks.getRequestAuth.mockReset().mockResolvedValue(null);
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
    Object.values(mocks.spacesService).forEach((fn) => {
      fn.mockReset();
    });
  });

  it("lists spaces using optional auth user", async () => {
    mocks.spacesService.listSpacesForUser.mockResolvedValue({
      mySpaces: [],
      discoverOpenSpaces: [{ id: "space_1" }],
    });

    let response = await GET(new Request("https://example.test"), routeCtx({}));
    expect(response.status).toBe(200);
    expect(mocks.spacesService.listSpacesForUser).toHaveBeenCalledWith(null);

    mocks.getRequestAuth.mockResolvedValueOnce({ userId: "user_2" });
    response = await GET(new Request("https://example.test"), routeCtx({}));
    expect(response.status).toBe(200);
    expect(mocks.spacesService.listSpacesForUser).toHaveBeenLastCalledWith("user_2");
  });

  it("creates a space with default private visibility", async () => {
    mocks.spacesService.createSpace.mockResolvedValue({ id: "space_1", visibility: "PRIVATE" });

    const response = await POST(
      jsonRequest("POST", "https://example.test", { name: "Friends" }),
      routeCtx({}),
    );

    expect(response.status).toBe(201);
    expect(mocks.spacesService.createSpace).toHaveBeenCalledWith({
      ownerUserId: "user_1",
      name: "Friends",
      visibility: "PRIVATE",
    });
  });

  it("supports private invite-code join", async () => {
    mocks.spacesService.joinPrivateSpaceByInviteCode.mockResolvedValue({
      spaceId: "space_1",
      joined: true,
    });

    const response = await joinByCode(
      jsonRequest("POST", "https://example.test", { code: "abc123" }),
      routeCtx({}),
    );

    expect(response.status).toBe(200);
    expect(mocks.spacesService.joinPrivateSpaceByInviteCode).toHaveBeenCalledWith(
      "user_1",
      "abc123",
      undefined,
    );
  });

  it("forwards expectedSpaceId for guarded invite joins", async () => {
    mocks.spacesService.joinPrivateSpaceByInviteCode.mockResolvedValue({
      spaceId: "space_1",
      joined: true,
    });

    const response = await joinByCode(
      jsonRequest("POST", "https://example.test", {
        code: "abc123",
        expectedSpaceId: "space_1",
      }),
      routeCtx({}),
    );

    expect(response.status).toBe(200);
    expect(mocks.spacesService.joinPrivateSpaceByInviteCode).toHaveBeenCalledWith(
      "user_1",
      "abc123",
      "space_1",
    );
  });

  it("exposes space detail/update through service with request user context", async () => {
    mocks.spacesService.getSpaceDetails.mockResolvedValue({ id: "space_1", isMember: true });
    mocks.spacesService.updateSpace.mockResolvedValue({ id: "space_1", name: "Renamed" });
    mocks.getRequestAuth.mockResolvedValue({ userId: "user_2" });

    let response = await getSpace(
      new Request("https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.spacesService.getSpaceDetails).toHaveBeenCalledWith("space_1", "user_2");

    response = await patchSpace(
      jsonRequest("PATCH", "https://example.test", { name: "Renamed" }),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.spacesService.updateSpace).toHaveBeenCalledWith("space_1", "user_2", {
      name: "Renamed",
    });
  });

  it("passes space customization fields through PATCH", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "owner_1" });
    mocks.spacesService.updateSpace.mockResolvedValue({ id: "space_1", name: "Anime" });

    const response = await patchSpace(
      jsonRequest("PATCH", "https://example.test", {
        description: "Vote on seasonal picks",
        logoUrl: "/uploads/abc123.webp",
        accentColor: "SKY",
      }),
      routeCtx({ spaceId: "space_1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.spacesService.updateSpace).toHaveBeenCalledWith("space_1", "owner_1", {
      description: "Vote on seasonal picks",
      logoUrl: "/uploads/abc123.webp",
      accentColor: "SKY",
    });
  });

  it("rejects invalid logoUrl payloads before service call", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "owner_1" });

    const response = await patchSpace(
      jsonRequest("PATCH", "https://example.test", {
        logoUrl: "https://bad.example/logo.webp",
      }),
      routeCtx({ spaceId: "space_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("logoUrl"),
    });
    expect(mocks.spacesService.updateSpace).not.toHaveBeenCalled();
  });

  it("lists members for members and returns mapped errors from service", async () => {
    mocks.spacesService.listSpaceMembers.mockResolvedValue({
      members: [{ userId: "user_1", role: "OWNER" }],
    });
    mocks.getRequestAuth.mockResolvedValue({ userId: "user_1" });

    let response = await getMembers(
      new Request("https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.spacesService.listSpaceMembers).toHaveBeenCalledWith("space_1", "user_1");

    mocks.spacesService.listSpaceMembers.mockRejectedValueOnce(
      new ApiError(403, "You must join this space first"),
    );
    response = await getMembers(
      new Request("https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You must join this space first",
    });
  });

  it("joins open spaces and maps joined state to status code", async () => {
    mocks.spacesService.joinOpenSpace.mockResolvedValueOnce({ joined: true });
    mocks.spacesService.joinOpenSpace.mockResolvedValueOnce({ joined: false });

    let response = await postMembers(
      jsonRequest("POST", "https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(201);

    response = await postMembers(
      jsonRequest("POST", "https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.spacesService.joinOpenSpace).toHaveBeenNthCalledWith(1, "space_1", "user_1");
  });

  it("reads and rotates private-space invites via service", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "owner_1" });
    mocks.spacesService.getPrivateSpaceInvite.mockResolvedValue({
      invite: { code: "ABCD1234", expiresAt: new Date("2026-03-12T10:00:00.000Z") },
    });
    mocks.spacesService.rotatePrivateSpaceInvite.mockResolvedValue({
      code: "NEWCODE1234",
      expiresAt: new Date("2026-03-12T10:00:00.000Z"),
      createdAt: new Date("2026-03-05T10:00:00.000Z"),
    });

    let response = await getInvite(
      new Request("https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.spacesService.getPrivateSpaceInvite).toHaveBeenCalledWith("space_1", "owner_1");

    response = await postInvite(
      jsonRequest("POST", "https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(201);
    expect(mocks.spacesService.rotatePrivateSpaceInvite).toHaveBeenCalledWith("space_1", "owner_1");
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "NEWCODE1234",
      }),
    );
  });

  it("maps invite service authorization errors", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "user_2" });
    mocks.spacesService.getPrivateSpaceInvite.mockRejectedValue(
      new ApiError(403, "Only the space owner can view space invites"),
    );

    const response = await getInvite(
      new Request("https://example.test"),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the space owner can view space invites",
    });
  });

  it("supports leave-space and owner member-removal flows", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "owner_1" });

    let response = await leaveSpace(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(204);
    expect(mocks.spacesService.leaveSpace).toHaveBeenCalledWith("space_1", "user_1");

    response = await removeMember(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ spaceId: "space_1", userId: "member_1" }),
    );
    expect(response.status).toBe(204);
    expect(mocks.spacesService.removeSpaceMember).toHaveBeenCalledWith(
      "space_1",
      "owner_1",
      "member_1",
    );
  });

  it("maps leave/remove service errors", async () => {
    mocks.spacesService.leaveSpace.mockRejectedValueOnce(
      new ApiError(400, "Space owner cannot leave the space"),
    );

    let response = await leaveSpace(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ spaceId: "space_1" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Space owner cannot leave the space",
    });

    mocks.getRequestAuth.mockResolvedValue({ userId: "user_1" });
    mocks.spacesService.removeSpaceMember.mockRejectedValueOnce(
      new ApiError(403, "Only the space owner can remove members"),
    );
    response = await removeMember(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ spaceId: "space_1", userId: "member_1" }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the space owner can remove members",
    });
  });
});
