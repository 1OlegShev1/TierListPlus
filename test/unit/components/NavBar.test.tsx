// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string | URL; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.toString()} {...rest}>
      {children}
    </a>
  ),
}));

import { NavBar } from "@/components/layout/NavBar";

describe("NavBar", () => {
  beforeEach(() => {
    mocks.usePathname.mockReset().mockReturnValue("/");
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides admin link for non-admin users", () => {
    render(<NavBar isAdmin={false} />);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("shows admin link for admins", () => {
    render(<NavBar isAdmin />);
    expect(screen.getByRole("link", { name: "Admin" })).toBeTruthy();
  });

  it("loads admin role from session endpoint when role is not provided", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ role: "ADMIN" }),
    });

    render(<NavBar />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Admin" })).toBeTruthy();
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
