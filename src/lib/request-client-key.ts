const IPV4_RE = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

function normalizeIpCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim().toLowerCase();
  if (!candidate || candidate === "unknown") return null;

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.replace(/:\d+$/, "");
  }

  if (IPV4_RE.test(candidate)) return candidate;
  if (candidate.includes(":") && IPV6_RE.test(candidate)) return candidate;
  return null;
}

function normalizeUserAgent(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value.trim().replace(/\s+/g, " ").slice(0, 120) || "unknown";
}

export function getRequestClientKey(request: Request, prefix: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const clientIp =
    normalizeIpCandidate(forwardedFor) ??
    normalizeIpCandidate(request.headers.get("x-real-ip")) ??
    null;
  if (clientIp) return `${prefix}:ip:${clientIp}`;

  return `${prefix}:ua:${normalizeUserAgent(request.headers.get("user-agent"))}`;
}
