interface RateLimitOptions {
  key: string;
  maxRequests: number;
  windowMs: number;
  now?: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const requestBuckets = new Map<string, number[]>();

export function takeRateLimitToken({
  key,
  maxRequests,
  windowMs,
  now = Date.now(),
}: RateLimitOptions): RateLimitResult {
  const windowStart = now - windowMs;
  const existing = requestBuckets.get(key) ?? [];
  const recent = existing.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    requestBuckets.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  requestBuckets.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}
