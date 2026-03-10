// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JoinSpaceByCodeForm } from "@/components/spaces/JoinSpaceByCodeForm";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  useUser: vi.fn(),
  apiPost: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("@/lib/api-client", () => ({
  apiPost: mocks.apiPost,
  getErrorMessage: mocks.getErrorMessage,
}));

describe("JoinSpaceByCodeForm", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.apiPost.mockReset().mockResolvedValue({ spaceId: "space_1" });
    mocks.getErrorMessage.mockClear();
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
    });
  });

  it("prefills the input from initialCode and joins with uppercase code", async () => {
    render(<JoinSpaceByCodeForm initialCode="abC123" />);

    const input = screen.getByPlaceholderText("Invite code") as HTMLInputElement;
    expect(input.value).toBe("ABC123");

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/spaces/join", { code: "ABC123" });
    });
    expect(mocks.push).toHaveBeenCalledWith("/spaces/space_1");
  });

  it("forwards expectedSpaceId when provided", async () => {
    render(<JoinSpaceByCodeForm initialCode="abC123" initialExpectedSpaceId="space_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/spaces/join", {
        code: "ABC123",
        expectedSpaceId: "space_1",
      });
    });
  });

  it("updates the input value when initialCode changes", () => {
    const { rerender } = render(<JoinSpaceByCodeForm initialCode="abc" />);

    const input = screen.getByPlaceholderText("Invite code") as HTMLInputElement;
    expect(input.value).toBe("ABC");

    rerender(<JoinSpaceByCodeForm initialCode="xyz9" />);
    expect(input.value).toBe("XYZ9");
  });
});
