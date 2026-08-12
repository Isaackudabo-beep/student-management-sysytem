// Purpose: Typed API client — attaches JWT and normalizes errors.
const RENDER_API = "https://student-management-sysytem-xx6i.onrender.com";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? RENDER_API : "http://localhost:4000");

export type ApiError = {
  success: false;
  message: string;
  details?: unknown;
};

export class ApiRequestError extends Error {
  status: number;
  details?: unknown;
  code?: string;

  constructor(status: number, message: string, details?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

type ZodFlattenDetails = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

/** Turn API / Zod error payloads into a readable multi-line message naming each field. */
export function formatApiError(err: unknown, fallback = "Request failed"): string {
  if (!(err instanceof ApiRequestError)) {
    return err instanceof Error ? err.message : fallback;
  }

  const details = err.details as ZodFlattenDetails | undefined;
  const fieldErrors = details?.fieldErrors;
  const lines: string[] = [];

  if (fieldErrors && typeof fieldErrors === "object") {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (!messages?.length) continue;
      lines.push(`${field}: ${messages.join("; ")}`);
    }
  }

  const formErrors = details?.formErrors?.filter(Boolean) ?? [];
  for (const msg of formErrors) lines.push(msg);

  if (lines.length > 0) {
    const fields = Object.keys(fieldErrors ?? {}).filter((k) => (fieldErrors?.[k]?.length ?? 0) > 0);
    const header =
      fields.length > 0
        ? `Validation failed (${fields.join(", ")})`
        : err.message || "Validation failed";
    return [header, ...lines].join("\n");
  }

  return err.message || fallback;
}

const TOKEN_KEY = "sms_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Clears JWT and any sms_* auth leftovers from browser storage. */
export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  for (const store of [localStorage, sessionStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith("sms_")) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  }

  // No auth cookies today — clear any sms_* cookies defensively.
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name?.startsWith("sms_")) continue;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      body.message ?? "Request failed",
      body.details,
      body.code
    );
  }

  return body as T;
}
