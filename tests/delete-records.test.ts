import { describe, expect, it } from "vitest";
import { confirmMatchesName } from "@/lib/admin/delete-records";

describe("confirmMatchesName", () => {
  it("accepts exact name, case-insensitive name, or DELETE", () => {
    expect(confirmMatchesName("Ashley Johnson", "Ashley Johnson")).toBe(true);
    expect(confirmMatchesName("ashley johnson", "Ashley Johnson")).toBe(true);
    expect(confirmMatchesName("DELETE", "Ashley Johnson")).toBe(true);
  });

  it("rejects empty or mismatched confirmations", () => {
    expect(confirmMatchesName("", "Ashley Johnson")).toBe(false);
    expect(confirmMatchesName("Ashley", "Ashley Johnson")).toBe(false);
    expect(confirmMatchesName("delete", "Ashley Johnson")).toBe(false);
  });
});
