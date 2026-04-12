import React from "react";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCookieAuth: vi.fn(),
  spaceActionPanel: vi.fn((..._args: unknown[]) => null),
  prisma: {
    space: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth", () => ({
  getCookieAuth: mocks.getCookieAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/components/spaces/SpaceActionPanel", () => ({
  SpaceActionPanel: (props: {
    defaultOpen?: boolean;
    defaultJoinCode?: string;
    defaultExpectedSpaceId?: string;
  }) => {
    mocks.spaceActionPanel(props);
    return null;
  },
}));

import SpacesPage from "@/app/spaces/page";

function findSpaceActionPanelProps(node: unknown): {
  defaultOpen?: boolean;
  defaultJoinCode?: string;
  defaultExpectedSpaceId?: string;
} | null {
  if (!React.isValidElement(node)) return null;
  const typedNode = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (typedNode.type && typeof typedNode.type === "function") {
    const name = (typedNode.type as { name?: string }).name;
    if (name === "SpaceActionPanel") {
      return typedNode.props as {
        defaultOpen?: boolean;
        defaultJoinCode?: string;
        defaultExpectedSpaceId?: string;
      };
    }
  }

  const children = React.Children.toArray(typedNode.props.children);
  for (const child of children) {
    const found = findSpaceActionPanelProps(child);
    if (found) return found;
  }
  return null;
}

describe("spaces page join code wiring", () => {
  beforeEach(() => {
    mocks.cookies.mockReset().mockResolvedValue({});
    mocks.getCookieAuth.mockReset().mockResolvedValue({ userId: "user_1" });
    mocks.spaceActionPanel.mockReset();
    mocks.prisma.space.findMany.mockReset();
    mocks.prisma.space.findMany
      .mockResolvedValueOnce([
        {
          id: "space_1",
          name: "Anime",
          description: null,
          logoUrl: null,
          accentColor: "SLATE",
          visibility: "OPEN",
          _count: { members: 1, templates: 0, sessions: 0 },
        },
      ])
      .mockResolvedValueOnce([]);
  });

  it("passes uppercase joinCode and opens actions panel when query is present", async () => {
    const tree = await SpacesPage({ searchParams: { joinCode: "ab12c" } });
    const props = findSpaceActionPanelProps(tree);

    expect(props).toEqual({
      defaultOpen: true,
      defaultJoinCode: "AB12C",
      defaultExpectedSpaceId: "",
    });
  });

  it("passes expectedSpaceId for guarded invite joins", async () => {
    const tree = await SpacesPage({
      searchParams: { joinCode: "ab12c", expectedSpaceId: "space_1" },
    });
    const props = findSpaceActionPanelProps(tree);

    expect(props).toEqual({
      defaultOpen: true,
      defaultJoinCode: "AB12C",
      defaultExpectedSpaceId: "space_1",
    });
  });

  it("keeps actions panel closed when member already has spaces and no joinCode query", async () => {
    const tree = await SpacesPage({ searchParams: {} });
    const props = findSpaceActionPanelProps(tree);

    expect(props).toEqual({
      defaultOpen: false,
      defaultJoinCode: "",
      defaultExpectedSpaceId: "",
    });
  });
});
