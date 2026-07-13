import { describe, expect, it, vi } from "vitest";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { requireOwnerProfile } from "@/lib/auth/require-owner";

vi.mock("@/lib/auth/current-profile", () => ({
  getCurrentProfile: vi.fn(),
}));

const mockedGetCurrentProfile = vi.mocked(getCurrentProfile);

describe("requireOwnerProfile", () => {
  it("returns 401 when no profile is authenticated", async () => {
    mockedGetCurrentProfile.mockResolvedValueOnce({ user: null, profile: null });

    const result = await requireOwnerProfile();

    expect(result.error?.status).toBe(401);
  });

  it("returns 403 for active admin profiles", async () => {
    mockedGetCurrentProfile.mockResolvedValueOnce({
      user: null,
      profile: { id: "admin-profile", role: "admin", active: true },
    });

    const result = await requireOwnerProfile();

    expect(result.error?.status).toBe(403);
  });

  it("returns 403 for active client profiles", async () => {
    mockedGetCurrentProfile.mockResolvedValueOnce({
      user: null,
      profile: { id: "client-profile", role: "client", active: true },
    });

    const result = await requireOwnerProfile();

    expect(result.error?.status).toBe(403);
  });

  it("returns 403 for inactive owner profiles", async () => {
    mockedGetCurrentProfile.mockResolvedValueOnce({
      user: null,
      profile: { id: "owner-profile", role: "owner", active: false },
    });

    const result = await requireOwnerProfile();

    expect(result.error?.status).toBe(403);
  });

  it("returns the active owner profile", async () => {
    const profile = { id: "owner-profile", role: "owner", active: true };
    mockedGetCurrentProfile.mockResolvedValueOnce({ user: null, profile });

    const result = await requireOwnerProfile();

    expect(result).toEqual({ profile });
  });
});
