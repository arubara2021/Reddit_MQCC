// src/server/core/cache.ts
import { redis } from '@devvit/web/server';
import { log } from './logger';

export async function getCached<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await redis.get(key);
    if (!raw || raw === 'null' || raw === 'undefined') return fallback;
    return JSON.parse(raw as string) as T;
  } catch (e) {
    log('cache', 'warn', 'Read failed', {
      key,
      error: e instanceof Error ? e.message : String(e),
    });
    return fallback;
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlMs: number
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), {
      expiration: new Date(Date.now() + ttlMs),
    });
  } catch (e) {
    log('cache', 'warn', 'Write failed', {
      key,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (e) {
    log('cache', 'warn', 'Delete failed', {
      key,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    const raw = await redis.get(key);
    return raw !== null && raw !== undefined;
  } catch {
    return false;
  }
}
