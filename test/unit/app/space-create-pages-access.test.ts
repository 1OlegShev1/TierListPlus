const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCookieAuth: vi.fn(),
  getSpaceAccessForUser: vi.fn(),
  canReadSpace: vi.fn(),
  prisma: {
    template: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (target: string) => {
    throw new Error(`REDIRECT:${target}`);
  },
}));

vi.mock("@/lib/auth", () => ({
  getCookieAuth: mocks.getCookieAuth,
}));

vi.mock("@/lib/space", () => ({
  getSpaceAccessForUser: mocks.getSpaceAccessForUser,
  canReadSpace: mocks.canReadSpace,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/components/templates/ListEditor", () => ({
  ListEditor: () => null,
}));

vi.mock("@/components/sessions/NewVoteForm", () => ({
  NewVoteForm: () => null,
}));

vi.mock("@/components/spaces/CopyListToSpaceButton", () => ({
  CopyListToSpaceButton: () => null,
}));

import NewVotePage from "@/app/sessions/new/page";
import SpaceImportTemplatePage from "@/app/spaces/[spaceId]/templates/import/page";
import NewListPage from "@/app/templates/new/page";

describe("space create page access", () => {
  beforeEach(() => {
    mocks.cookies.mockReset().mockResolvedValue({});
    mocks.getCookieAuth.mockReset().mockResolvedValue({ userId: "user_1" });
    mocks.getSpaceAccessForUser.mockReset();
    mocks.canReadSpace.mockReset();
    mocks.prisma.template.findMany.mockReset().mockResolvedValue([]);
    mocks.prisma.template.findUnique.mockReset().mockResolvedValue(null);
  });

  it("redirects open-space non-members from new list page to the space page", async () => {
    mocks.getSpaceAccessForUser.mockResolvedValue({
      id: "space_1",
      name: "Anime",
      visibility: "OPEN",
      creatorId: "owner_1",
      isMember: false,
      isOwner: false,
      role: null,
    });
    mocks.canReadSpace.mockReturnValue(true);

    await expect(NewListPage({ searchParams: { spaceId: "space_1" } })).rejects.toThrow(
      "REDIRECT:/spaces/space_1",
    );
  });

  it("keeps private-space non-members hidden on new list page", async () => {
    mocks.getSpaceAccessForUser.mockResolvedValue({
      id: "space_1",
      name: "Secret",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      isMember: false,
      isOwner: false,
      role: null,
    });
    mocks.canReadSpace.mockReturnValue(false);

    await expect(NewListPage({ searchParams: { spaceId: "space_1" } })).rejects.toThrow("NOT_FOUND");
  });

  it("redirects open-space non-members from new vote page to the space page", async () => {
    mocks.getSpaceAccessForUser.mockResolvedValue({
      id: "space_1",
      name: "Anime",
      visibility: "OPEN",
      creatorId: "owner_1",
      isMember: false,
      isOwner: false,
      role: null,
    });
    mocks.canReadSpace.mockReturnValue(true);

    await expect(NewVotePage({ searchParams: { spaceId: "space_1" } })).rejects.toThrow(
      "REDIRECT:/spaces/space_1",
    );
    expect(mocks.prisma.template.findMany).not.toHaveBeenCalled();
  });

  it("keeps private-space non-members hidden on new vote page", async () => {
    mocks.getSpaceAccessForUser.mockResolvedValue({
      id: "space_1",
      name: "Secret",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      isMember: false,
      isOwner: false,
      role: null,
    });
    mocks.canReadSpace.mockReturnValue(false);

    await expect(NewVotePage({ searchParams: { spaceId: "space_1" } })).rejects.toThrow("NOT_FOUND");
    expect(mocks.prisma.template.findMany).not.toHaveBeenCalled();
  });

  it("redirects open-space non-members from import page to the space page", async () => {
    mocks.getSpaceAccessForUser.mockResolvedValue({
      id: "space_1",
      name: "Anime",
      visibility: "OPEN",
      creatorId: "owner_1",
      isMember: false,
      isOwner: false,
      role: null,
    });
    mocks.canReadSpace.mockReturnValue(true);

    await expect(SpaceImportTemplatePage({ params: Promise.resolve({ spaceId: "space_1" }) })).rejects.toThrow(
      "REDIRECT:/spaces/space_1",
    );
    expect(mocks.prisma.template.findMany).not.toHaveBeenCalled();
  });

  it("keeps private-space non-members hidden on import page", async () => {
    mocks.getSpaceAccessForUser.mockResolvedValue({
      id: "space_1",
      name: "Secret",
      visibility: "PRIVATE",
      creatorId: "owner_1",
      isMember: false,
      isOwner: false,
      role: null,
    });
    mocks.canReadSpace.mockReturnValue(false);

    await expect(SpaceImportTemplatePage({ params: Promise.resolve({ spaceId: "space_1" }) })).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(mocks.prisma.template.findMany).not.toHaveBeenCalled();
  });
});
