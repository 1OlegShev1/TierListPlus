/** Client-side fetch wrapper that checks res.ok and extracts JSON. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public details: unknown
  ) {
    super(typeof details === "string" ? details : "Request failed");
  }
}

/** Fetch JSON from an API route, throwing ApiClientError on non-ok responses. */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    let details: unknown;
    try {
      const json = await res.json();
      details = json.error ?? json.message ?? `Request failed (${res.status})`;
    } catch {
      details = `Request failed (${res.status})`;
    }
    throw new ApiClientError(res.status, details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** POST JSON to an API route. */
export function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** PATCH JSON to an API route. */
export function apiPatch<T = unknown>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Extract a user-friendly error message from an unknown error. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiClientError) {
    return typeof error.details === "string" ? error.details : fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
