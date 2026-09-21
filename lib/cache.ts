// Small in-memory TTL cache with in-flight request de-duplication.
// Prices/inventory change quickly, so TTLs here are intentionally short —
// this exists to stop duplicate/rapid-fire calls from burning API credits,
// not to serve stale prices.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true
): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = fn()
    .then((value) => {
      if (shouldCache(value)) {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
