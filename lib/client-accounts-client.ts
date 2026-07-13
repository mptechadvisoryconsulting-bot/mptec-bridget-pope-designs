"use client";

export type ClientAccountsApiResult =
  | { ok: true; message?: string; payload?: unknown }
  | { ok: false; message: string; code: string; status?: number; payload?: unknown };

type RequestOptions = {
  body?: unknown;
  fetchImpl?: typeof fetch;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  timeoutMs?: number;
};

export const CLIENT_ACCOUNTS_TIMEOUT_MS = 20_000;

const statusMessages: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "Only admins can manage client accounts.",
  404: "That client account could not be found.",
  409: "That action is not available for this client right now.",
  422: "Client details need attention before this action can continue.",
  500: "The request could not complete. Please try again.",
};

async function parseResponse(response: Response): Promise<{ parsed: unknown; invalid: boolean }> {
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

function payloadMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return null;
}

function payloadCode(payload: unknown) {
  if (payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string") {
    return payload.code;
  }

  return null;
}

export async function requestClientAccountsApi(path: string, options: RequestOptions = {}): Promise<ClientAccountsApiResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? CLIENT_ACCOUNTS_TIMEOUT_MS;
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(path, {
      method: options.method ?? "POST",
      headers: options.body ? { Accept: "application/json", "Content-Type": "application/json" } : { Accept: "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const { parsed, invalid } = await parseResponse(response);

    if (invalid) {
      return {
        ok: false,
        code: "INVALID_API_RESPONSE",
        message: "The server returned an invalid response.",
        status: response.status,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        code: payloadCode(parsed) ?? `HTTP_${response.status}`,
        message: payloadMessage(parsed) ?? statusMessages[response.status] ?? "The request could not complete. Please try again.",
        status: response.status,
        payload: parsed,
      };
    }

    return {
      ok: true,
      message: payloadMessage(parsed) ?? undefined,
      payload: parsed,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        code: "REQUEST_TIMEOUT",
        message: "The request took too long to respond. Please try again.",
      };
    }

    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "Unable to reach the server. Please try again.",
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
