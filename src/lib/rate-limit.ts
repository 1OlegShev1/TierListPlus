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

interface RequestBucket {
  timestamps: number[];
  windowMs: number;
}

const requestBuckets = new Map<string, RequestBucket>();
const RATE_LIMIT_MAX_BUCKETS = 5_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 30_000;
let nextCleanupAt = 0;

function pruneBuckets(now: number) {
  for (const [bucketKey, bucket] of requestBuckets) {
    const windowStart = now - bucket.windowMs;
    const recent = bucket.timestamps.filter((timestamp) => timestamp > windowStart);
    if (recent.length === 0) {
      requestBuckets.delete(bucketKey);
      continue;
    }
    bucket.timestamps = recent;
    requestBuckets.set(bucketKey, bucket);
  }

  while (requestBuckets.size > RATE_LIMIT_MAX_BUCKETS) {
    const oldestKey = requestBuckets.keys().next().value;
    if (!oldestKey) break;
    requestBuckets.delete(oldestKey);
  }
}

export function takeRateLimitToken({
  key,
  maxRequests,
  windowMs,
  now = Date.now(),
}: RateLimitOptions): RateLimitResult {
  if (now >= nextCleanupAt || requestBuckets.size > RATE_LIMIT_MAX_BUCKETS) {
    pruneBuckets(now);
    nextCleanupAt = now + RATE_LIMIT_CLEANUP_INTERVAL_MS;
  }

  const windowStart = now - windowMs;
  const existing = requestBuckets.get(key);
  const recent = (existing?.timestamps ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    requestBuckets.set(key, {
      timestamps: recent,
      windowMs: Math.max(existing?.windowMs ?? 0, windowMs),
    });
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  requestBuckets.delete(key);
  requestBuckets.set(key, {
    timestamps: recent,
    windowMs: Math.max(existing?.windowMs ?? 0, windowMs),
  });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function __clearRateLimitBucketsForTests() {
  requestBuckets.clear();
  nextCleanupAt = 0;
}

export function __getRateLimitBucketCountForTests() {
  return requestBuckets.size;
}
