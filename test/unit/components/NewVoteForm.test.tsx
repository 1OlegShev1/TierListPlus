// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewVoteForm } from "@/components/sessions/NewVoteForm";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
  useUser: vi.fn(),
  saveParticipant: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    back: mocks.back,
  }),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("@/lib/api-client", () => ({
  apiPost: mocks.apiPost,
  getErrorMessage: mocks.getErrorMessage,
}));

vi.mock("@/hooks/useParticipant", () => ({
  saveParticipant: mocks.saveParticipant,
}));

describe("NewVoteForm", () => {
  const initialLists = [
    {
      id: "template_1",
      name: "Movies",
      isPublic: true,
      _count: { items: 1 },
      items: [{ id: "item_1", imageUrl: "/img/1.webp", label: "One" }],
    },
  ];

  beforeEach(() => {
    mocks.apiPost.mockReset();
    mocks.getErrorMessage.mockClear();
    mocks.saveParticipant.mockReset();
    mocks.push.mockReset();
    mocks.back.mockReset();
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  it("creates from a picked list and redirects straight to vote editor", async () => {
    mocks.apiPost.mockResolvedValue({
      id: "session_1",
      participantId: "participant_1",
      participantNickname: "Host",
    });

    render(<NewVoteForm initialLists={initialLists} />);
    fireEvent.click(screen.getByRole("button", { name: /movies/i }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions", {
        templateId: "template_1",
        name: "Movies Vote",
        nickname: "Host",
        isPrivate: true,
      });
    });
    expect(mocks.saveParticipant).toHaveBeenCalledWith("session_1", "participant_1", "Host");
    expect(mocks.push).toHaveBeenCalledWith("/sessions/session_1/vote?editName=1");
  });

  it("starts blank without sending template id and uses blank default name", async () => {
    mocks.apiPost.mockResolvedValue({
      id: "session_1",
      participantId: "participant_1",
      participantNickname: "Host",
    });

    render(<NewVoteForm initialLists={initialLists} />);

    fireEvent.click(screen.getByRole("button", { name: /start blank/i }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions", {
        name: "Blank Canvas Vote",
        nickname: "Host",
        isPrivate: true,
      });
    });
  });

  it("uses initial nickname when available", async () => {
    mocks.apiPost.mockResolvedValue({
      id: "session_1",
      participantId: "participant_1",
      participantNickname: "LastUsedNick",
    });

    render(<NewVoteForm initialNickname="LastUsedNick" initialLists={initialLists} />);
    fireEvent.click(screen.getByRole("button", { name: /movies/i }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions", {
        templateId: "template_1",
        name: "Movies Vote",
        nickname: "LastUsedNick",
        isPrivate: true,
      });
    });
  });

  it("uses space sessions endpoint and omits isPrivate for space votes", async () => {
    mocks.apiPost.mockResolvedValue({
      id: "session_1",
      participantId: "participant_1",
      participantNickname: "Host",
    });

    render(<NewVoteForm spaceId="space_1" initialLists={initialLists} />);
    fireEvent.click(screen.getByRole("button", { name: /movies/i }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/spaces/space_1/sessions", {
        templateId: "template_1",
        name: "Movies Vote",
        nickname: "Host",
      });
    });
  });

  it("ignores repeated clicks while create is already in flight", async () => {
    let resolveCreate:
      | ((value: { id: string; participantId: string; participantNickname: string }) => void)
      | undefined;
    mocks.apiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    render(<NewVoteForm initialLists={initialLists} />);
    const startButton = screen.getByRole("button", { name: /movies/i });

    await act(async () => {
      fireEvent.click(startButton);
      fireEvent.click(startButton);
    });

    expect(mocks.apiPost).toHaveBeenCalledTimes(1);

    if (!resolveCreate) throw new Error("Expected create request to start");
    const resolveCreateRequest = resolveCreate;
    await act(async () => {
      resolveCreateRequest({
        id: "session_1",
        participantId: "participant_1",
        participantNickname: "Host",
      });
      await Promise.resolve();
    });
  });
});
