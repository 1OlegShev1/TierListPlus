const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCookieAuth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/lib/auth", () => ({
  getCookieAuth: mocks.getCookieAuth,
}));

vi.mock("@/components/admin/AdminStatsPage", () => ({
  AdminStatsPage: () => null,
}));

import AdminPage from "@/app/admin/page";

describe("admin page access", () => {
  beforeEach(() => {
    mocks.cookies.mockReset().mockResolvedValue({});
    mocks.getCookieAuth.mockReset().mockResolvedValue(null);
  });

  it("hides admin page from anonymous or non-admin users", async () => {
    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");

    mocks.getCookieAuth.mockResolvedValueOnce({
      userId: "user_1",
      role: "USER",
    });
    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
  });

  it("renders for admins", async () => {
    mocks.getCookieAuth.mockResolvedValueOnce({
      userId: "admin_1",
      role: "ADMIN",
    });

    const page = await AdminPage();
    expect(page).toBeTruthy();
  });
});
