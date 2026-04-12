// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CopyListToSpaceButton } from "@/components/spaces/CopyListToSpaceButton";

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

describe("CopyListToSpaceButton", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.apiPost.mockReset().mockResolvedValue({ id: "template_copy_1" });
    mocks.getErrorMessage.mockClear();
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  it("prevents duplicate imports after successful copy while navigating", async () => {
    render(<CopyListToSpaceButton spaceId="space_1" sourceTemplateId="template_1" />);

    const button = screen.getByRole("button", { name: "Copy to Space" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledTimes(1);
    });
    expect(mocks.push).toHaveBeenCalledWith("/templates/template_copy_1/edit");

    fireEvent.click(button);
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  });

  it("re-enables copy when import request fails", async () => {
    mocks.apiPost
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "template_copy_2" });

    render(<CopyListToSpaceButton spaceId="space_1" sourceTemplateId="template_1" />);

    const button = screen.getByRole("button", { name: "Copy to Space" });
    fireEvent.click(button);

    await screen.findByText("Could not copy this list into the space");

    fireEvent.click(screen.getByRole("button", { name: "Copy to Space" }));
    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledTimes(2);
    });
  });
});
