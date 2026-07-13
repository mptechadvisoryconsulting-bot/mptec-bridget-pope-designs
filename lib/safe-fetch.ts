"use client";

/**
 * Shared client-side fetch helper. Never throws on network
 * failure or a non-JSON response body, always resolves to a typed result, and always
 * clears its timeout via `finally`.
 */
export type SafeFetchResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: SafeFetchErrorCode; message: string; data?: T };

export type SafeFetchErrorCode =
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "INVALID_API_RESPONSE"
  | `HTTP_${number}`
  | "HTTP_ERROR";

type SafeFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export const DEFAULT_SAFE_FETCH_TIMEOUT_MS = 20_000;

const genericStatusMessages: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to do that.",
  404: "That could not be found.",
  409: "That could not be completed because of a conflicting change. Please try again.",
  422: "That request needs attention before it can continue.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong. Please try again.",
  502: "The server is temporarily unavailable. Please try again.",
  503: "The server is temporarily unavailable. Please try again.",
  504: "The request took too long to respond. Please try again.",
};

function messageFromPayload(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string") {
    return (payload as { message: string }).message;
  }
  return null;
}

async function parseJsonResponse(response: Response): Promise<{ parsed: unknown; invalid: boolean }> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (!body) {
    return { parsed: null, invalid: !response.ok };
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    return { parsed: null, invalid: true };
  }

  try {
    return { parsed: JSON.parse(body), invalid: false };
  } catch {
    return { parsed: null, invalid: true };
  }
}

/**
 * Performs a JSON fetch that never throws. Handles network failures, timeouts, and
 * non-JSON (HTML error page, empty body, etc.) responses uniformly so callers can render
 * a consistent error state instead of crashing on `response.json()`.
 */
export async function safeFetch<T = unknown>(path: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult<T>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_SAFE_FETCH_TIMEOUT_MS;
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;

  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetchImpl(path, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const { parsed, invalid } = await parseJsonResponse(response);

    if (invalid) {
      return {
        ok: false,
        status: response.status,
        code: "INVALID_API_RESPONSE",
        message: response.ok ? "The server returned an unexpected response." : genericStatusMessages[response.status] ?? "The server returned an unexpected response.",
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: `HTTP_${response.status}` as SafeFetchErrorCode,
        message: messageFromPayload(parsed) ?? genericStatusMessages[response.status] ?? "The request failed. Please try again.",
        data: parsed as T,
      };
    }

    return { ok: true, status: response.status, data: parsed as T };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, status: 0, code: "REQUEST_TIMEOUT", message: "The request took too long to respond. Please try again." };
    }

    return { ok: false, status: 0, code: "NETWORK_ERROR", message: "Unable to reach the server. Check your connection and try again." };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
