"use client";

type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function readCached<T>(key: string, maxAgeMs: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
  return entry.value as T;
}

export function writeCached<T>(key: string, value: T): void {
  cache.set(key, { value, fetchedAt: Date.now() });
}

export async function fetchWithStaleCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs = 30_000,
): Promise<T> {
  const cached = readCached<T>(key, maxAgeMs);
  if (cached !== null) {
    return cached;
  }
  try {
    const fresh = await fetcher();
    writeCached(key, fresh);
    return fresh;
  } catch (error) {
    const stale = cache.get(key);
    if (stale) {
      return stale.value as T;
    }
    throw error;
  }
}
