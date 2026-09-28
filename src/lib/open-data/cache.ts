const cache = new Map<string, { expires: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<{ data: T; cacheHit: boolean }> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return { data: hit.data as T, cacheHit: true };
  const pending = inflight.get(key);
  if (pending) return { data: await pending as T, cacheHit: true };
  const request = load();
  inflight.set(key, request);
  try {
    const data = await request;
    cache.set(key, { data, expires: Date.now() + ttl });
    return { data, cacheHit: false };
  } finally {
    if (inflight.get(key) === request) inflight.delete(key);
  }
}
