import { MAX_RESOLVER_REDIRECTS } from "@/lib/source-preview/constants";
import { getBlockedUrlReasonWithDns } from "@/lib/source-preview/security";

interface SafeFetchOptions {
  timeoutMs: number;
  maxRedirects?: number;
  followRedirects?: boolean;
}

export class SourcePreviewBlockedError extends Error {
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "SourcePreviewBlockedError";
    this.reason = reason;
  }
}

export function isSourcePreviewBlockedError(error: unknown): error is SourcePreviewBlockedError {
  return error instanceof SourcePreviewBlockedError;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal, redirect: "manual" });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseRedirectTarget(currentUrl: string, location: string): URL | null {
  try {
    const target = new URL(location, currentUrl);
    if (!["https:", "http:"].includes(target.protocol)) return null;
    if (target.username || target.password) return null;
    return target;
  } catch {
    return null;
  }
}

export async function fetchWithPolicy(
  inputUrl: string,
  init: RequestInit,
  options: SafeFetchOptions,
): Promise<{ response: Response; finalUrl: string } | null> {
  const maxRedirects = options.maxRedirects ?? MAX_RESOLVER_REDIRECTS;
  const followRedirects = options.followRedirects ?? true;
  let currentUrl = inputUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const blockedReason = await getBlockedUrlReasonWithDns(currentUrl);
    if (blockedReason) {
      throw new SourcePreviewBlockedError(blockedReason);
    }

    const response = await fetchWithTimeout(currentUrl, init, options.timeoutMs);
    if (!response) return null;

    if (
      followRedirects &&
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      const target = parseRedirectTarget(currentUrl, response.headers.get("location") ?? "");
      if (!target) return null;
      currentUrl = target.toString();
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  return null;
}

export async function readResponseTextLimited(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  if (!response.body) {
    try {
      return (await response.text()).slice(0, maxBytes);
    } catch {
      return null;
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let output = "";

  try {
    while (bytesRead < maxBytes) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - bytesRead;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      bytesRead += chunk.byteLength;
      output += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength) {
        break;
      }
    }
    output += decoder.decode();
    return output;
  } catch {
    return null;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation errors.
    }
  }
}
