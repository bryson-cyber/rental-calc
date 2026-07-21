/**
 * Minimal in-memory sliding-window rate limiter for abuse-prone procedures.
 * Single-process by design (matches the app's single-server deployment); the
 * goal is stopping ops-email floods and unbounded provider-account creation,
 * not precise distributed quotas.
 */
const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const stamps = (buckets.get(key) ?? []).filter((stamp) => stamp > cutoff);

  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();

  if (stamps.length >= limit) {
    buckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return true;
}
