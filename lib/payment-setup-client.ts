"use client";

export type PaymentSetupApiResult =
  | { ok: true; url?: string; message?: string; code?: string; correlationId?: string; payload?: unknown }
  | { ok: false; message: string; code: string; status?: number; stage?: string; correlationId?: string; payload?: unknown };

type RequestOptions = {
  fetchImpl?: typeof fetch;
  method?: "GET" | "POST";
  timeoutMs?: number;
};

export const PAYMENT_SETUP_TIMEOUT_MS = 20_000;

const statusMessages: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "Only the owner can manage payment setup.",
  404: "Payment setup could not be found.",
  409: "Stripe setup is not ready for that action yet.",
  422: "Payment setup needs attention before this action can continue.",
  500: "Payment setup could not complete. Please try again.",
  502: "Stripe setup is temporarily unavailable. Please try again.",
  503: "Stripe setup is temporarily unavailable. Please try again.",
  504: "Stripe setup took too long to respond. Please try again.",
};

export function isValidStripeRedirectUrl(value: unknown) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"));
  } catch {
    return false;
  }
}

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

function payloadStage(payload: unknown) {
  if (payload && typeof payload === "object" && "stage" in payload && typeof payload.stage === "string") {
    return payload.stage;
  }

  return null;
}

function payloadCorrelationId(payload: unknown) {
  if (payload && typeof payload === "object" && "correlationId" in payload && typeof payload.correlationId === "string") {
    return payload.correlationId;
  }

  return null;
}

function payloadUrl(payload: unknown) {
  if (payload && typeof payload === "object" && "url" in payload) {
    return payload.url;
  }

  return null;
}

export async function requestPaymentSetupApi(path: string, options: RequestOptions = {}): Promise<PaymentSetupApiResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? PAYMENT_SETUP_TIMEOUT_MS;
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(path, {
      method: options.method ?? "POST",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const { parsed, invalid } = await parseResponse(response);

    if (invalid) {
      return {
        ok: false,
        code: "INVALID_API_RESPONSE",
        message: "Payment setup returned an invalid response.",
        status: response.status,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        code: payloadCode(parsed) ?? `HTTP_${response.status}`,
        message: payloadMessage(parsed) ?? statusMessages[response.status] ?? "Payment setup could not complete. Please try again.",
        status: response.status,
        stage: payloadStage(parsed) ?? undefined,
        correlationId: payloadCorrelationId(parsed) ?? undefined,
        payload: parsed,
      };
    }

    const url = payloadUrl(parsed);
    if (url !== null && !isValidStripeRedirectUrl(url)) {
      return {
        ok: false,
        code: "INVALID_REDIRECT_URL",
        message: "Payment setup returned an invalid response.",
        status: response.status,
        payload: parsed,
      };
    }

    return {
      ok: true,
      url: typeof url === "string" ? url : undefined,
      message: payloadMessage(parsed) ?? undefined,
      code: payloadCode(parsed) ?? undefined,
      correlationId: payloadCorrelationId(parsed) ?? undefined,
      payload: parsed,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        code: "REQUEST_TIMEOUT",
        message: "Stripe setup took too long to respond. Please try again.",
      };
    }

    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "Unable to reach payment setup. Please try again.",
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
