import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google.internal.",
  "instance-data",
  "instance-data.ec2.internal",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home",
  ".lan",
];
const DNS_LOOKUP_TIMEOUT_MS = 1_500;

function normalizeHost(input: string): string {
  let normalized = input.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  const zoneSeparator = normalized.indexOf("%");
  if (zoneSeparator >= 0) {
    normalized = normalized.slice(0, zoneSeparator);
  }
  return normalized.replace(/\.$/, "");
}

function parseIPv4(host: string): number[] | null {
  const segments = host.split(".");
  if (segments.length !== 4) return null;
  const bytes = segments.map((segment) => Number.parseInt(segment, 10));
  if (bytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return bytes;
}

function isBlockedIPv4(host: string): boolean {
  const bytes = parseIPv4(host);
  if (!bytes) return false;
  const [a, b] = bytes;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0 && bytes[2] === 2) return true;
  if (a === 198 && b === 51 && bytes[2] === 100) return true;
  if (a === 203 && b === 0 && bytes[2] === 113) return true;
  if (a >= 224) return true;

  return false;
}

function isBlockedIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (/^fc/i.test(normalized) || /^fd/i.test(normalized)) return true;
  if (/^fe[89ab]/i.test(normalized)) return true;
  if (/^ff/i.test(normalized)) return true;
  if (normalized.startsWith("2001:db8:")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mappedDotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedDotted) return isBlockedIPv4(mappedDotted);

    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedHex?.[1] && mappedHex[2]) {
      const high = Number.parseInt(mappedHex[1], 16);
      const low = Number.parseInt(mappedHex[2], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        const mapped = `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
        return isBlockedIPv4(mapped);
      }
    }
  }

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isBlockedIPv4(mapped[1]);

  return false;
}

export function normalizeParentHostname(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = normalizeHost(input);
  if (!raw || raw.length > 253) return null;
  if (raw === "localhost") return raw;
  if (!/^[a-z0-9.-]+$/.test(raw)) return null;
  if (raw.includes("..") || raw.startsWith(".") || raw.endsWith(".")) return null;

  const labels = raw.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length === 0 || label.length > 63 || label.startsWith("-") || label.endsWith("-"),
    )
  ) {
    return null;
  }

  return raw;
}

export function getBlockedHostReason(hostname: string): string | null {
  const host = normalizeHost(hostname);
  if (!host) return "Blocked empty host";

  if (BLOCKED_HOSTNAMES.has(host)) {
    return "Blocked local/metadata host";
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "Blocked local network hostname";
  }

  if (!host.includes(".") && !host.includes(":") && isIP(host) === 0) {
    return "Blocked single-label internal hostname";
  }

  if (isBlockedIPv4(host)) {
    return "Blocked private/reserved IPv4 address";
  }

  if (isIP(host) === 6 && isBlockedIPv6(host)) {
    return "Blocked private/reserved IPv6 address";
  }

  return null;
}

export function getBlockedUrlReason(inputUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return "Invalid URL";
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    return "Invalid URL scheme";
  }
  if (parsed.username || parsed.password) {
    return "Blocked credentialed URL";
  }

  return getBlockedHostReason(parsed.hostname);
}

async function lookupHostAddresses(hostname: string): Promise<string[]> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const results = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }).catch(() => null),
    new Promise<null>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(null), DNS_LOOKUP_TIMEOUT_MS);
    }),
  ]);
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  if (!results) return [];

  const addresses = Array.isArray(results) ? results.map((entry) => entry.address) : [];
  return [...new Set(addresses.map((address) => normalizeHost(address)).filter(Boolean))];
}

export async function getBlockedResolvedAddressReason(hostname: string): Promise<string | null> {
  const host = normalizeHost(hostname);
  if (!host || isIP(host) !== 0) {
    return null;
  }

  const addresses = await lookupHostAddresses(host);
  for (const address of addresses) {
    if (getBlockedHostReason(address)) {
      return "Blocked DNS-resolved private/reserved address";
    }
  }
  return null;
}

export async function getBlockedUrlReasonWithDns(inputUrl: string): Promise<string | null> {
  const blockedReason = getBlockedUrlReason(inputUrl);
  if (blockedReason) return blockedReason;

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return "Invalid URL";
  }

  return getBlockedResolvedAddressReason(parsed.hostname);
}
