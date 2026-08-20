import { describe, expect, it } from "vitest";
import { canAccessConversation } from "@/lib/auth/conversation-access";

describe("conversation access", () => {
  it("allows owner and admin roles to access project conversations", () => {
    expect(canAccessConversation({ role: "owner", profileId: "owner-1" })).toBe(true);
    expect(canAccessConversation({ role: "admin", profileId: "admin-1" })).toBe(true);
  });

  it("allows the client attached to the conversation", () => {
    expect(
      canAccessConversation({
        role: "client",
        profileId: "client-a",
        clientProfileId: "client-a",
        assignedAdminId: "admin-1",
      }),
    ).toBe(true);
  });

  it("allows the admin assigned to that project", () => {
    expect(
      canAccessConversation({
        role: "planner",
        profileId: "planner-1",
        clientProfileId: "client-a",
        assignedAdminId: "planner-1",
      }),
    ).toBe(true);
  });

  it("blocks one client from another client's conversation", () => {
    expect(
      canAccessConversation({
        role: "client",
        profileId: "client-b",
        clientProfileId: "client-a",
        assignedAdminId: "admin-1",
      }),
    ).toBe(false);
  });

  it("blocks unrelated authenticated profiles", () => {
    expect(
      canAccessConversation({
        role: "client",
        profileId: "unrelated",
        clientProfileId: "client-a",
        assignedAdminId: "admin-1",
      }),
    ).toBe(false);
  });
});
