import { redis, reddit, context } from '@devvit/web/server';
import { REDIS_KEYS } from './constants';
import { log } from './logger';
import type { ModActionRecord } from '../../shared/api';

interface ActionResult {
  success: boolean;
  message: string;
}

export type BanDuration = 0 | 1 | 3 | 7 | 14 | 30 | 999;

const VALID_DURATIONS: number[] = [0, 1, 3, 7, 14, 30, 999];

function normalizeDuration(input: number | undefined): number {
  if (input === undefined || input === null) return 0;
  if (VALID_DURATIONS.includes(input)) return input;
  let closest = 0;
  let minDiff = Infinity;
  for (const d of VALID_DURATIONS) {
    const diff = Math.abs(d - input);
    if (diff < minDiff) {
      minDiff = diff;
      closest = d;
    }
  }
  return closest;
}

function formatDuration(days: number): string {
  switch (days) {
    case 0: return 'permanent';
    case 1: return '1 day';
    case 3: return '3 days';
    case 7: return '7 days';
    case 14: return '14 days';
    case 30: return '30 days';
    case 999: return 'permanent';
    default: return days + ' days';
  }
}

async function getCurrentModName(): Promise<string> {
  try {
    const name = await reddit.getCurrentUsername();
    return name || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function recordAction(record: ModActionRecord): Promise<void> {
  try {
    const key = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
    const raw = await redis.get(key);
    const actions: ModActionRecord[] = raw ? JSON.parse(raw as string) : [];
    actions.push(record);
    const trimmed = actions.slice(-500);
    await redis.set(key, JSON.stringify(trimmed), {
      expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  } catch (e) {
    log('modActions', 'warn', 'Failed to record action', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function approveItem(
  fullname: string,
  authorName?: string
): Promise<ActionResult> {
  try {
    log('modActions', 'info', 'Calling reddit.approve', { fullname });
    await (reddit as any).approve(fullname);
    log('modActions', 'info', 'reddit.approve succeeded', { fullname });

    const modName = await getCurrentModName();
    await recordAction({
      action: 'approve',
      targetAuthor: authorName || '',
      targetId: fullname,
      reason: null,
      modName,
      timestamp: Date.now(),
    });

    return { success: true, message: 'Approved' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'reddit.approve failed', {
      fullname,
      error: msg,
    });
    return { success: false, message: 'Approve failed: ' + msg };
  }
}

export async function removeItem(
  fullname: string,
  authorName?: string
): Promise<ActionResult> {
  try {
    log('modActions', 'info', 'Calling reddit.remove', { fullname });
    await (reddit as any).remove(fullname, false);
    log('modActions', 'info', 'reddit.remove succeeded', { fullname });

    const modName = await getCurrentModName();
    await recordAction({
      action: 'remove',
      targetAuthor: authorName || '',
      targetId: fullname,
      reason: null,
      modName,
      timestamp: Date.now(),
    });

    return { success: true, message: 'Removed' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'reddit.remove failed', {
      fullname,
      error: msg,
    });
    return { success: false, message: 'Remove failed: ' + msg };
  }
}

export async function lockItem(
  fullname: string,
  authorName?: string
): Promise<ActionResult> {
  try {
    log('modActions', 'info', 'Calling reddit.lock', { fullname });
    await (reddit as any).lock(fullname);
    log('modActions', 'info', 'reddit.lock succeeded', { fullname });

    const modName = await getCurrentModName();
    await recordAction({
      action: 'lock',
      targetAuthor: authorName || '',
      targetId: fullname,
      reason: null,
      modName,
      timestamp: Date.now(),
    });

    return { success: true, message: 'Locked' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'reddit.lock failed', {
      fullname,
      error: msg,
    });
    return { success: false, message: 'Lock failed: ' + msg };
  }
}

export async function banUser(
  username: string,
  reason: string,
  durationDays?: number
): Promise<ActionResult> {
  try {
    const subredditName = context.subredditName;
    if (!subredditName) {
      return { success: false, message: 'No subreddit context' };
    }

    const duration = normalizeDuration(durationDays);
    const durationLabel = formatDuration(duration);

    log('modActions', 'info', 'Calling reddit.banUser', {
      username,
      subredditName,
      duration: durationLabel,
      durationDays: duration,
    });

    await (reddit as any).banUser({
      subredditName,
      username,
      reason: reason || 'Banned via MQCC',
      duration,
    });

    log('modActions', 'info', 'reddit.banUser succeeded', {
      username,
      duration: durationLabel,
    });

    const modName = await getCurrentModName();
    const actionLabel =
      duration === 0 || duration === 999
        ? 'ban (permanent)'
        : 'ban (' + durationLabel + ')';

    await recordAction({
      action: 'ban',
      targetAuthor: username,
      targetId: '',
      reason: (reason || 'Banned via MQCC') + ' [' + actionLabel + ']',
      modName,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message:
        'u/' +
        username +
        ' banned' +
        (duration > 0 && duration < 999 ? ' for ' + durationLabel : ''),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'reddit.banUser failed', {
      username,
      error: msg,
    });
    return { success: false, message: 'Ban failed: ' + msg };
  }
}

export async function removeAndBan(
  fullname: string,
  username: string,
  reason: string,
  durationDays?: number
): Promise<ActionResult> {
  const removeResult = await removeItem(fullname, username);
  const banResult = await banUser(
    username,
    reason || 'Coordinated spam via MQCC',
    durationDays
  );

  if (removeResult.success && banResult.success) {
    return {
      success: true,
      message: 'Removed and banned u/' + username,
    };
  }

  const errors: string[] = [];
  if (!removeResult.success) errors.push('remove: ' + removeResult.message);
  if (!banResult.success) errors.push('ban: ' + banResult.message);

  return { success: false, message: errors.join('; ') };
}

export function getDurationOptions(): Array<{
  value: number;
  label: string;
}> {
  return [
    { value: 1, label: '1 day' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 0, label: 'Permanent' },
  ];
}
