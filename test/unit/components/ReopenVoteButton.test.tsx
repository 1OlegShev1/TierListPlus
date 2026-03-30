// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReopenVoteButton } from "@/components/sessions/ReopenVoteButton";

const mocks = vi.hoisted(() => ({
  apiPatch: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
  useUser: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
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

describe("ReopenVoteButton", () => {
  beforeEach(() => {
    mocks.apiPatch.mockReset().mockResolvedValue({});
    mocks.getErrorMessage.mockClear();
    mocks.useUser.mockReset().mockReturnValue({ userId: "user_1" });
    mocks.refresh.mockReset();
  });

  it("hides immediately and refreshes the current route after reopening", async () => {
    const onReopened = vi.fn();

    render(
      <ReopenVoteButton
        sessionId="session_1"
        creatorId="user_1"
        status="CLOSED"
        label="Reopen"
        onReopened={onReopened}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen ranking" }));

    await waitFor(() => {
      expect(mocks.apiPatch).toHaveBeenCalledWith("/api/sessions/session_1", { status: "OPEN" });
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
    });

    expect(onReopened).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("stays hidden unless the viewer owns a closed vote", () => {
    mocks.useUser.mockReturnValue({ userId: "user_2" });

    const { rerender } = render(
      <ReopenVoteButton sessionId="session_2" creatorId="user_1" status="CLOSED" label="Reopen" />,
    );

    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();

    mocks.useUser.mockReturnValue({ userId: "user_1" });
    rerender(
      <ReopenVoteButton sessionId="session_2" creatorId="user_1" status="OPEN" label="Reopen" />,
    );
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });
});
