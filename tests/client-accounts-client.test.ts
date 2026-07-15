import { describe, expect, it, vi } from "vitest";
import { requestClientAccountsApi } from "@/lib/client-accounts-client";

describe("client accounts API requests", () => {
  it("returns the server message for non-ok JSON responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "That client could not be found." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    }));

    const result = await requestClientAccountsApi("/api/admin/client-accounts/missing/resend-invitation", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({ ok: false, message: "That client could not be found.", status: 404 }));
  });

  it("handles HTML error pages as invalid API responses", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>error</html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    }));

    const result = await requestClientAccountsApi("/api/admin/client-accounts", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      code: "INVALID_API_RESPONSE",
      message: "The server returned an invalid response.",
    }));
  });

  it("handles malformed JSON as an invalid API response", async () => {
    const fetchImpl = vi.fn(async () => new Response("{", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const result = await requestClientAccountsApi("/api/admin/client-accounts", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: "INVALID_API_RESPONSE" }));
  });

  it("handles network failures with a resettable error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await requestClientAccountsApi("/api/admin/client-accounts", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: "NETWORK_ERROR" }));
  });

  it("aborts requests that exceed the timeout", async () => {
    const fetchImpl = vi.fn((_path: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );

    const result = await requestClientAccountsApi("/api/admin/client-accounts", { fetchImpl, timeoutMs: 1 });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: "REQUEST_TIMEOUT" }));
  });

  it("returns ok for successful JSON responses and surfaces the server message", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true, message: "Invitation resent to ashley@example.com." }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const result = await requestClientAccountsApi("/api/admin/client-accounts/profile-1/resend-invitation", { fetchImpl });

    expect(result).toEqual(expect.objectContaining({ ok: true, message: "Invitation resent to ashley@example.com." }));
  });
});
