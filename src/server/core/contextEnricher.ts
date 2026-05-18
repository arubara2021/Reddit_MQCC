// src/server/core/contextEnricher.ts
import { redis, reddit, context } from '@devvit/web/server';
import { REDIS_KEYS, TTL } from './constants';
import { getCached, setCached } from './cache';
import { log } from './logger';
import type { UserContext, ModActionRecord } from '../../shared/api';

interface RawUserResult {
  accountAgeDays: number;
  totalKarma: number;
  postKarma: number;
  commentKarma: number;
  isSuspended: boolean;
  isShadowbanned: boolean;
}

const EMPTY_USER: RawUserResult = {
  accountAgeDays: -1,
  totalKarma: -1,
  postKarma: -1,
  commentKarma: -1,
  isSuspended: false,
  isShadowbanned: false,
};

async function fetchUserFromReddit(username: string): Promise<RawUserResult> {
  const result = { ...EMPTY_USER };

  try {
    const user = await (reddit as any).getUserByUsername(username);

    if (!user) {
      log('contextEnricher', 'warn', 'User not found', { username });
      result.isShadowbanned = true;
      return result;
    }

    // Parse account age from createdAt
    const createdAt = user.createdAt;
    if (createdAt instanceof Date) {
      result.accountAgeDays = Math.floor(
        (Date.now() - createdAt.getTime()) / 86400000
      );
    } else if (typeof createdAt === 'number') {
      const ts = createdAt > 1e12 ? createdAt : createdAt * 1000;
      result.accountAgeDays = Math.floor((Date.now() - ts) / 86400000);
    } else if (typeof createdAt === 'string') {
      const parsed = new Date(createdAt);
      if (!isNaN(parsed.getTime())) {
        result.accountAgeDays = Math.floor(
          (Date.now() - parsed.getTime()) / 86400000
        );
      }
    }

    // Parse karma
    result.postKarma = user.linkKarma || user.postKarma || 0;
    result.commentKarma = user.commentKarma || 0;
    result.totalKarma =
      user.totalKarma || result.postKarma + result.commentKarma;

    // Parse account status
    if (user.isSuspended || user.is_suspended) result.isSuspended = true;
    if (user.isShadowbanned || user.is_shadowbanned)
      result.isShadowbanned = true;

    log('contextEnricher', 'info', 'User profile fetched', {
      username,
      accountAgeDays: result.accountAgeDays,
      totalKarma: result.totalKarma,
    });

    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('contextEnricher', 'warn', 'getUserByUsername failed', {
      username,
      error: msg,
    });

    if (msg.includes('suspended')) result.isSuspended = true;
    if (
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('does not exist')
    ) {
      result.isShadowbanned = true;
    }

    return result;
  }
}

async function buildContextFromDb(
  username: string,
  userData: RawUserResult
): Promise<UserContext> {
  // Load mod action history
  const actionsKey = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
  const actionsRaw = await redis.get(actionsKey);
  const allActions: ModActionRecord[] = actionsRaw
    ? JSON.parse(actionsRaw as string)
    : [];
  const userActions = allActions.filter(
    (a) => a.targetAuthor.toLowerCase() === username.toLowerCase()
  );

  // Load queue appearance count
  const appearancesKey =
    REDIS_KEYS.QUEUE_APPEARANCES + username.toLowerCase();
  const appearancesRaw = await redis.get(appearancesKey);
  const queueAppearances = appearancesRaw
    ? parseInt(appearancesRaw as string, 10) || 0
    : 0;

  return {
    username,
    accountAgeDays: userData.accountAgeDays,
    totalKarma: userData.totalKarma,
    postKarma: userData.postKarma,
    commentKarma: userData.commentKarma,
    previousActionCount: userActions.length,
    lastActionType:
      userActions.length > 0
        ? userActions[userActions.length - 1].action
        : null,
    lastActionTimestamp:
      userActions.length > 0
        ? userActions[userActions.length - 1].timestamp
        : 0,
    queueAppearances,
    isSuspended: userData.isSuspended,
    isShadowbanned: userData.isShadowbanned,
    cachedAt: Date.now(),
  };
}

export async function getUserContext(username: string): Promise<UserContext> {
  if (!username || username === '[deleted]') {
    return buildContextFromDb(username, EMPTY_USER);
  }

  const cacheKey = REDIS_KEYS.USER_CONTEXT + username.toLowerCase();
  const cached = await getCached<UserContext | null>(cacheKey, null);

  // Use cache only if it has real data
  if (
    cached &&
    cached.accountAgeDays > 0 &&
    Date.now() - cached.cachedAt < TTL.USER_CONTEXT_MS
  ) {
    log('contextEnricher', 'info', 'Returning cached context', {
      username,
      accountAgeDays: cached.accountAgeDays,
    });
    return cached;
  }

  const userData = await fetchUserFromReddit(username);
  const userContext = await buildContextFromDb(username, userData);

  try {
    await setCached(cacheKey, userContext, TTL.USER_CONTEXT_MS);
  } catch (e) {
    log('contextEnricher', 'warn', 'Cache write failed', { username });
  }

  log('contextEnricher', 'info', 'Final user context', {
    username,
    accountAgeDays: userContext.accountAgeDays,
    totalKarma: userContext.totalKarma,
    previousActionCount: userContext.previousActionCount,
    queueAppearances: userContext.queueAppearances,
  });

  return userContext;
}

export async function incrementQueueAppearance(
  username: string
): Promise<void> {
  if (!username || username === '[deleted]') return;

  const key = REDIS_KEYS.QUEUE_APPEARANCES + username.toLowerCase();
  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) + 1 : 1;

  await redis.set(key, String(count), {
    expiration: new Date(Date.now() + TTL.APPEARANCES_MS),
  });
}

export async function enrichQueueItems(
  items: Array<{ authorName: string }>
): Promise<UserContext[]> {
  const seenAuthors = new Map<string, UserContext>();
  const results: UserContext[] = [];
  const pending: Array<{ lower: string; index: number }> = [];

  for (let i = 0; i < items.length; i++) {
    const authorLower = items[i].authorName.toLowerCase();
    if (seenAuthors.has(authorLower)) {
      results.push(seenAuthors.get(authorLower)!);
    } else {
      results.push({
        username: items[i].authorName,
        accountAgeDays: -1,
        totalKarma: -1,
        postKarma: -1,
        commentKarma: -1,
        previousActionCount: 0,
        lastActionType: null,
        lastActionTimestamp: 0,
        queueAppearances: 0,
        isSuspended: false,
        isShadowbanned: false,
        cachedAt: 0,
      });
      pending.push({ lower: authorLower, index: i });
    }
  }

  if (pending.length > 0) {
    log('contextEnricher', 'info', 'Enriching ' + pending.length + ' users', {
      users: pending.map((p) => p.lower).join(', '),
    });
  }

  // Process in batches of 3 to avoid rate limiting
  for (let i = 0; i < pending.length; i += 3) {
    const batch = pending.slice(i, i + 3);
    const resolved = await Promise.allSettled(
      batch.map((p) => getUserContext(p.lower))
    );

    for (let j = 0; j < batch.length; j++) {
      if (resolved[j].status === 'fulfilled') {
        const ctx = (resolved[j] as PromiseFulfilledResult<UserContext>).value;
        seenAuthors.set(batch[j].lower, ctx);
        results[batch[j].index] = ctx;
      }
    }
  }

  return results;
}
