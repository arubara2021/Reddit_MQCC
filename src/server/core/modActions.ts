import { reddit, redis, context } from '@devvit/web/server';
import { log } from './logger';
import { REDIS_KEYS, TTL } from './constants';
import type { ModActionRecord, BannedUserRecord } from '../../shared/api';

type ActionResult = { success: boolean; message: string };

const VALID_BAN_DURATIONS = [0, 1, 3, 7, 14, 30];
const BANNED_PREFIX = 'mqcc:banned:';

export function getDurationOptions(): Array<{ value: number; label: string }> {
  return [
    { value: 0, label: 'Permanent' },
    { value: 1, label: '1 day' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
  ];
}

function normalizeBanDuration(days?: number): number {
  if (!days || days <= 0) return 0;
  let closest = 0;
  for (const valid of VALID_BAN_DURATIONS) {
    if (valid > 0 && valid <= days) closest = valid;
  }
  return closest;
}

function bannedKey(): string {
  return BANNED_PREFIX + context.subredditId;
}

async function addToBannedList(
  username: string,
  reason: string,
  durationDays: number
): Promise<void> {
  try {
    const modName = await getCurrentModName();
    const now = Date.now();
    const normalized = normalizeBanDuration(durationDays);

    const record: BannedUserRecord = {
      username: username.toLowerCase(),
      reason,
      durationDays: normalized,
      bannedBy: modName,
      bannedAt: now,
      expiresAt: normalized > 0 ? now + normalized * 86400000 : null,
    };

    const key = bannedKey();
    const raw = await redis.get(key);
    const list: BannedUserRecord[] = raw ? JSON.parse(raw as string) : [];

    const filtered = list.filter(
      (b) => b.username !== username.toLowerCase()
    );
    filtered.push(record);

    await redis.set(key, JSON.stringify(filtered), {
      expiration: new Date(Date.now() + TTL.MOD_ACTIONS_MS),
    });
  } catch (e) {
    log('modActions', 'warn', 'Failed to add to banned list', {
      username,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function removeFromBannedList(username: string): Promise<void> {
  try {
    const key = bannedKey();
    const raw = await redis.get(key);
    const list: BannedUserRecord[] = raw ? JSON.parse(raw as string) : [];

    const filtered = list.filter(
      (b) => b.username !== username.toLowerCase()
    );

    await redis.set(key, JSON.stringify(filtered), {
      expiration: new Date(Date.now() + TTL.MOD_ACTIONS_MS),
    });
  } catch (e) {
    log('modActions', 'warn', 'Failed to remove from banned list', {
      username,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function getCurrentModName(): Promise<string> {
  try {
    const username = await reddit.getCurrentUsername();
    if (username) return username;
  } catch {}
  return 'unknown';
}

async function recordAction(
  action: ModActionRecord['action'],
  targetAuthor: string,
  targetId: string,
  reason: string | null
): Promise<void> {
  try {
    const modName = await getCurrentModName();

    const key = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
    const raw = await redis.get(key);
    const actions: ModActionRecord[] = raw ? JSON.parse(raw as string) : [];

    actions.push({
      action,
      targetAuthor,
      targetId,
      reason,
      modName,
      timestamp: Date.now(),
    });

    const trimmed = actions.slice(-500);
    await redis.set(key, JSON.stringify(trimmed), {
      expiration: new Date(Date.now() + TTL.MOD_ACTIONS_MS),
    });
  } catch (e) {
    log('modActions', 'warn', 'Failed to record action', {
      action,
      targetAuthor,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function approveItem(
  fullname: string,
  authorName: string
): Promise<ActionResult> {
  try {
    if (fullname.startsWith('t1_')) {
      const comment = await reddit.getCommentById(fullname as `t1_${string}`);
      await comment.approve();
    } else if (fullname.startsWith('t3_')) {
      const post = await reddit.getPostById(fullname as `t3_${string}`);
      await post.approve();
    } else {
      return { success: false, message: 'Unknown content type: ' + fullname };
    }

    await recordAction('approve', authorName, fullname, null);

    log('modActions', 'info', 'Content approved', { fullname, authorName });
    return { success: true, message: 'Approved u/' + authorName };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'Approve failed', { fullname, authorName, error: msg });
    return { success: false, message: 'Approve failed: ' + msg };
  }
}

export async function removeItem(
  fullname: string,
  authorName: string
): Promise<ActionResult> {
  try {
    if (fullname.startsWith('t1_')) {
      const comment = await reddit.getCommentById(fullname as `t1_${string}`);
      await comment.remove();
    } else if (fullname.startsWith('t3_')) {
      const post = await reddit.getPostById(fullname as `t3_${string}`);
      await post.remove();
    } else {
      return { success: false, message: 'Unknown content type: ' + fullname };
    }

    await recordAction('remove', authorName, fullname, null);

    log('modActions', 'info', 'Content removed', { fullname, authorName });
    return { success: true, message: 'Removed u/' + authorName };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'Remove failed', { fullname, authorName, error: msg });
    return { success: false, message: 'Remove failed: ' + msg };
  }
}

export async function lockItem(
  fullname: string,
  authorName: string
): Promise<ActionResult> {
  try {
    if (fullname.startsWith('t1_')) {
      const comment = await reddit.getCommentById(fullname as `t1_${string}`);
      await comment.lock();
    } else if (fullname.startsWith('t3_')) {
      const post = await reddit.getPostById(fullname as `t3_${string}`);
      await post.lock();
    } else {
      return { success: false, message: 'Unknown content type: ' + fullname };
    }

    await recordAction('lock', authorName, fullname, null);

    log('modActions', 'info', 'Content locked', { fullname, authorName });
    return { success: true, message: 'Locked u/' + authorName };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'Lock failed', { fullname, authorName, error: msg });
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

    const normalized = normalizeBanDuration(durationDays);

    const banOptions: Record<string, unknown> = {
      subredditName,
      username,
    };

    if (reason) banOptions.reason = reason;
    if (normalized > 0) banOptions.duration = normalized;

    await (reddit as any).banUser(banOptions);

    await recordAction('ban', username, username, reason);
    await addToBannedList(username, reason, normalized);

    const durationLabel = normalized > 0 ? normalized + 'd' : 'permanent';
    log('modActions', 'info', 'User banned', {
      username,
      subredditName,
      duration: durationLabel,
    });

    return {
      success: true,
      message: 'Banned u/' + username + ' (' + durationLabel + ')',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'Ban failed', { username, error: msg });
    return { success: false, message: 'Ban failed: ' + msg };
  }
}

export async function unbanUser(username: string): Promise<ActionResult> {
  try {
    const subredditName = context.subredditName;
    if (!subredditName) {
      return { success: false, message: 'No subreddit context' };
    }

    await (reddit as any).unbanUser({ subredditName, username });

    await recordAction('approve', username, 'unban:' + username, 'Unbanned via MQCC');
    await removeFromBannedList(username);

    log('modActions', 'info', 'User unbanned', { username, subredditName });
    return { success: true, message: 'Unbanned u/' + username };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'Unban failed', { username, error: msg });
    return { success: false, message: 'Unban failed: ' + msg };
  }
}

export async function removeAndBan(
  fullname: string,
  username: string,
  reason: string,
  durationDays?: number
): Promise<ActionResult> {
  try {
    const removeResult = await removeItem(fullname, username);
    if (!removeResult.success) {
      log('modActions', 'warn', 'Remove failed during removeAndBan', {
        fullname,
        username,
        error: removeResult.message,
      });
    }

    const banResult = await banUser(username, reason, durationDays);
    if (!banResult.success) {
      return {
        success: false,
        message: 'Remove succeeded but ban failed: ' + banResult.message,
      };
    }

    await recordAction('removeAndBan', username, fullname, reason);

    log('modActions', 'info', 'Removed and banned', { fullname, username });
    return { success: true, message: 'Removed & banned u/' + username };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('modActions', 'error', 'Remove and ban failed', {
      fullname,
      username,
      error: msg,
    });
    return { success: false, message: 'Remove & ban failed: ' + msg };
  }
}

export async function getBannedUsers(): Promise<BannedUserRecord[]> {
  try {
    const key = bannedKey();
    const raw = await redis.get(key);
    if (!raw) return [];

    const list: BannedUserRecord[] = JSON.parse(raw as string);
    const now = Date.now();

    const active = list.filter((b) => {
      if (b.expiresAt === null) return true;
      return b.expiresAt > now;
    });

    if (active.length !== list.length) {
      await redis.set(key, JSON.stringify(active), {
        expiration: new Date(Date.now() + TTL.MOD_ACTIONS_MS),
      });
    }

    return active.sort((a, b) => b.bannedAt - a.bannedAt);
  } catch (e) {
    log('modActions', 'warn', 'Failed to get banned users', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}
