// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewVoteForm } from "@/components/sessions/NewVoteForm";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
  useUser: vi.fn(),
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
  apiFetch: mocks.apiFetch,
  apiPost: mocks.apiPost,
  getErrorMessage: mocks.getErrorMessage,
}));

vi.mock("@/hooks/useParticipant", () => ({
  saveParticipant: vi.fn(),
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

  const initialSelectedListDetails = {
    id: "template_1",
    name: "Movies",
    items: [{ id: "item_1", imageUrl: "/img/1.webp", label: "One" }],
  };

  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiPost.mockReset();
    mocks.getErrorMessage.mockClear();
    mocks.push.mockReset();
    mocks.back.mockReset();
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  it("submits trimmed name and nickname values", async () => {
    mocks.apiPost.mockResolvedValue({
      id: "session_1",
      participantId: "participant_1",
      participantNickname: "Host",
    });

    render(
      <NewVoteForm
        initialLists={initialLists}
        initialSelectedListId="template_1"
        initialSelectedListDetails={initialSelectedListDetails}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g., Best Burgers in Town"), {
      target: { value: "  Friday Vote  " },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Alex"), {
      target: { value: "  Host  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Vote" }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions", {
        templateId: "template_1",
        name: "Friday Vote",
        nickname: "Host",
        isPrivate: true,
      });
    });
  });

  it("prefills nickname from initial suggestion", () => {
    render(
      <NewVoteForm
        initialNickname="LastUsedNick"
        initialLists={initialLists}
        initialSelectedListId="template_1"
        initialSelectedListDetails={initialSelectedListDetails}
      />,
    );

    expect((screen.getByPlaceholderText("e.g., Alex") as HTMLInputElement).value).toBe(
      "LastUsedNick",
    );
  });

  it("can start blank without sending a template id", async () => {
    mocks.apiPost.mockResolvedValue({
      id: "session_1",
      participantId: "participant_1",
      participantNickname: "Host",
    });

    render(<NewVoteForm initialLists={initialLists} />);

    fireEvent.click(screen.getByRole("button", { name: /start blank/i }));

    fireEvent.change(screen.getByPlaceholderText("e.g., Best Burgers in Town"), {
      target: { value: "Blank Vote" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Alex"), {
      target: { value: "Host" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Vote" }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions", {
        name: "Blank Vote",
        nickname: "Host",
        isPrivate: true,
      });
    });
  });

  it("shows a disabled visibility field for space votes", () => {
    render(
      <NewVoteForm
        spaceId="space_1"
        spaceName="Space"
        initialLists={initialLists}
        initialSelectedListId="template_1"
        initialSelectedListDetails={initialSelectedListDetails}
      />,
    );

    const privateOption = screen.getByRole("radio", { name: "Private" });
    const publicOption = screen.getByRole("radio", { name: "Public" });
    expect(privateOption.getAttribute("disabled")).not.toBeNull();
    expect(publicOption.getAttribute("disabled")).not.toBeNull();
    expect(
      screen.getByText("Visibility for space votes is managed in Space Settings."),
    ).toBeTruthy();
  });

  it("ignores repeated submits while create is already in flight", async () => {
    let resolveCreate:
      | ((value: { id: string; participantId: string; participantNickname: string }) => void)
      | undefined;
    mocks.apiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    render(
      <NewVoteForm
        initialLists={initialLists}
        initialSelectedListId="template_1"
        initialSelectedListDetails={initialSelectedListDetails}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g., Best Burgers in Town"), {
      target: { value: "Friday Vote" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Alex"), {
      target: { value: "Host" },
    });

    const form = screen.getByRole("button", { name: "Start Vote" }).closest("form");
    if (!form) throw new Error("Expected submit form");

    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
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
