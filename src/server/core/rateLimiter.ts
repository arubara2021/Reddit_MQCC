// src/server/core/rateLimiter.ts
import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from './constants';
import { log } from './logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 30,
};

const ACTION_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = REDIS_KEYS.RATE_LIMIT + identifier;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const raw = await redis.get(key);
    let timestamps: number[] = raw ? JSON.parse(raw as string) : [];

    // Remove timestamps outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const remaining = config.maxRequests - timestamps.length;

    if (remaining <= 0) {
      const resetAt = timestamps[0] + config.windowMs;
      log('rateLimiter', 'warn', 'Rate limit exceeded', {
        identifier,
        requests: timestamps.length,
        maxRequests: config.maxRequests,
      });
      return { allowed: false, remaining: 0, resetAt };
    }

    // Add current timestamp
    timestamps.push(now);

    await redis.set(key, JSON.stringify(timestamps), {
      expiration: new Date(now + config.windowMs * 2),
    });

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt: now + config.windowMs,
    };
  } catch (e) {
    log('rateLimiter', 'warn', 'Rate limit check failed', {
      identifier,
      error: e instanceof Error ? e.message : String(e),
    });
    // Fail open — allow the request if rate limiter is broken
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
    };
  }
}

export async function checkActionRateLimit(
  modName: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimit('action:' + modName, ACTION_CONFIG);
}

export async function checkBulkRateLimit(
  modName: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimit('bulk:' + modName, {
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
  });
}
