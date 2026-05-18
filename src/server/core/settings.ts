// src/server/core/settings.ts
import { redis, context } from '@devvit/web/server';
import { REDIS_KEYS, TTL, DEFAULT_SETTINGS } from './constants';
import { getCached, setCached } from './cache';
import { log } from './logger';
import type { AppSettings } from '../../shared/api';

export async function getSettings(): Promise<AppSettings> {
  const key = REDIS_KEYS.SETTINGS + context.subredditId;
  const cached = await getCached<AppSettings | null>(key, null);

  if (cached) {
    // Merge with defaults to fill any missing fields
    return {
      ...DEFAULT_SETTINGS,
      ...cached,
      priorityWeights: {
        ...DEFAULT_SETTINGS.priorityWeights,
        ...(cached.priorityWeights || {}),
      },
    };
  }

  return { ...DEFAULT_SETTINGS };
}

export async function updateSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings();

  const merged: AppSettings = {
    ...current,
    ...updates,
    priorityWeights: {
      ...current.priorityWeights,
      ...(updates.priorityWeights || {}),
    },
  };

  // Validate weights sum to ~1.0
  const weights = merged.priorityWeights;
  const total =
    weights.reportCount +
    weights.accountAge +
    weights.karma +
    weights.queueHistory +
    weights.modHistory;

  if (Math.abs(total - 1.0) > 0.01) {
    log('settings', 'warn', 'Priority weights do not sum to 1.0', {
      total,
    });
    // Normalize weights
    if (total > 0) {
      merged.priorityWeights = {
        reportCount: weights.reportCount / total,
        accountAge: weights.accountAge / total,
        karma: weights.karma / total,
        queueHistory: weights.queueHistory / total,
        modHistory: weights.modHistory / total,
      };
    }
  }

  // Validate refresh interval
  if (merged.refreshIntervalMs < 10000) {
    merged.refreshIntervalMs = 10000;
  }
  if (merged.refreshIntervalMs > 300000) {
    merged.refreshIntervalMs = 300000;
  }

  const key = REDIS_KEYS.SETTINGS + context.subredditId;
  await setCached(key, merged, TTL.SETTINGS_MS);

  log('settings', 'info', 'Settings updated', {
    subredditId: context.subredditId,
    autoRefresh: merged.autoRefresh,
    refreshIntervalMs: merged.refreshIntervalMs,
    compactMode: merged.compactMode,
  });

  return merged;
}

export async function resetSettings(): Promise<AppSettings> {
  const key = REDIS_KEYS.SETTINGS + context.subredditId;
  await setCached(key, DEFAULT_SETTINGS, TTL.SETTINGS_MS);

  log('settings', 'info', 'Settings reset to defaults', {
    subredditId: context.subredditId,
  });

  return { ...DEFAULT_SETTINGS };
}
