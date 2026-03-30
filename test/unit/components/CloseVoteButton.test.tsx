// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";

const mocks = vi.hoisted(() => ({
  apiPatch: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
  useUser: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
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
  apiPatch: mocks.apiPatch,
  getErrorMessage: mocks.getErrorMessage,
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    onConfirm,
    onCancel,
    loading,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
  }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

describe("CloseVoteButton", () => {
  beforeEach(() => {
    mocks.apiPatch.mockReset().mockResolvedValue({});
    mocks.getErrorMessage.mockClear();
    mocks.useUser.mockReset().mockReturnValue({ userId: "user_1" });
    mocks.push.mockReset();
    mocks.refresh.mockReset();
  });

  it("hides immediately and refreshes the current route after closing in place", async () => {
    const onClosed = vi.fn();

    render(
      <CloseVoteButton
        sessionId="session_1"
        creatorId="user_1"
        status="OPEN"
        label="End"
        onClosed={onClosed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "End" }));
    fireEvent.click(screen.getByRole("button", { name: "Close ranking" }));

    await waitFor(() => {
      expect(mocks.apiPatch).toHaveBeenCalledWith("/api/sessions/session_1", { status: "CLOSED" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "End" })).toBeNull();
    });

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("redirects without refreshing the current route when redirectHref is provided", async () => {
    render(
      <CloseVoteButton
        sessionId="session_2"
        creatorId="user_1"
        status="OPEN"
        label="End"
        redirectHref="/sessions/session_2/results"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "End" }));
    fireEvent.click(screen.getByRole("button", { name: "Close ranking" }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/sessions/session_2/results");
    });

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "End" })).toBeNull();
  });
});
