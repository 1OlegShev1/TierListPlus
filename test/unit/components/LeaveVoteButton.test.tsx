// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LeaveVoteButton } from "@/components/sessions/LeaveVoteButton";

const mocks = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
  clearParticipant: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/hooks/useParticipant", () => ({
  useParticipant: () => ({
    participantId: "participant_1",
    nickname: "Oleg",
    save: vi.fn(),
    clear: mocks.clearParticipant,
  }),
}));

vi.mock("@/lib/api-client", () => ({
  apiDelete: mocks.apiDelete,
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

describe("LeaveVoteButton", () => {
  beforeEach(() => {
    mocks.apiDelete.mockReset().mockResolvedValue(undefined);
    mocks.getErrorMessage.mockClear();
    mocks.clearParticipant.mockReset();
    mocks.push.mockReset();
    mocks.refresh.mockReset();
  });

  it("shows open-vote leave consequences in confirmation copy", async () => {
    render(<LeaveVoteButton sessionId="session_1" joinCode="ABCD12" label="Leave now" />);

    fireEvent.click(screen.getByRole("button", { name: "Leave now" }));

    expect(
      screen.getByText(
        "This removes your ballot from this vote. You can rejoin while voting is open, but you will start from scratch.",
      ),
    ).toBeTruthy();
  });

  it("shows locked-vote leave consequences in confirmation copy", async () => {
    render(<LeaveVoteButton sessionId="session_1" joinCode="ABCD12" isLocked label="Leave now" />);

    fireEvent.click(screen.getByRole("button", { name: "Leave now" }));

    expect(
      screen.getByText(
        "This removes your ballot from this vote. Joins are currently locked, so you will not be able to rejoin unless a host unlocks joins.",
      ),
    ).toBeTruthy();
  });

  it("deletes participant membership and redirects to join page", async () => {
    render(<LeaveVoteButton sessionId="session_1" joinCode="ABCD12" label="Leave" />);

    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave vote" }));

    await waitFor(() => {
      expect(mocks.apiDelete).toHaveBeenCalledWith("/api/sessions/session_1/participants/me");
    });
    expect(mocks.clearParticipant).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/sessions/join?code=ABCD12");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows API error in the confirmation description", async () => {
    mocks.apiDelete.mockRejectedValue(new Error("boom"));
    mocks.getErrorMessage.mockReturnValue("Could not leave this vote");

    render(<LeaveVoteButton sessionId="session_1" joinCode="ABCD12" label="Leave" />);

    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave vote" }));

    await waitFor(() => {
      expect(screen.getByText("Could not leave this vote")).toBeTruthy();
    });
    expect(mocks.clearParticipant).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
