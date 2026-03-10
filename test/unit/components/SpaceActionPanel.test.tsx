// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { SpaceActionPanel } from "@/components/spaces/SpaceActionPanel";

const mocks = vi.hoisted(() => ({
  joinForm: vi.fn(),
}));

vi.mock("@/components/spaces/CreateSpaceForm", () => ({
  CreateSpaceForm: () => <div>CreateForm</div>,
}));

vi.mock("@/components/spaces/JoinSpaceByCodeForm", () => ({
  JoinSpaceByCodeForm: (props: { initialCode?: string; initialExpectedSpaceId?: string }) => {
    mocks.joinForm({
      initialCode: props.initialCode ?? "",
      initialExpectedSpaceId: props.initialExpectedSpaceId ?? "",
    });
    return <div>JoinForm</div>;
  },
}));

describe("SpaceActionPanel", () => {
  beforeEach(() => {
    mocks.joinForm.mockReset();
  });

  it("opens when defaultOpen becomes true after initial render", () => {
    const { rerender } = render(
      <SpaceActionPanel defaultOpen={false} defaultJoinCode="" defaultExpectedSpaceId="" />,
    );

    expect(screen.queryByText("CreateForm")).toBeNull();
    expect(screen.queryByText("JoinForm")).toBeNull();

    rerender(
      <SpaceActionPanel
        defaultOpen={true}
        defaultJoinCode="AB12"
        defaultExpectedSpaceId="space_1"
      />,
    );

    expect(screen.getByText("CreateForm")).toBeTruthy();
    expect(screen.getByText("JoinForm")).toBeTruthy();
    expect(mocks.joinForm).toHaveBeenCalledWith({
      initialCode: "AB12",
      initialExpectedSpaceId: "space_1",
    });
  });
});
