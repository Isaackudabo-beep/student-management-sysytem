// Purpose: Typed API client — attaches JWT and normalizes errors.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiError = {
  success: false;
  message: string;
  details?: unknown;
};

export class ApiRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
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

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sms_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("sms_token", token);
  else localStorage.removeItem("sms_token");
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
      body.details
    );
  }

  return body as T;
}
