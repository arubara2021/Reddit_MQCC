import { Hono } from 'hono';
import { reddit, redis, context } from '@devvit/web/server';
import { log } from '../core/logger';
import { REDIS_KEYS } from '../core/constants';
import { getCached } from '../core/cache';
import type { ModActionRecord } from '../../shared/api';

const community = new Hono();

const EMPTY_DATA = {
  success: true,
  data: {
    stats: { active: 0, posts: 0, health: 0 },
    contributors: [] as Array<{ name: string; score: number }>,
    commenters: [] as Array<{ name: string; score: number }>,
    karma: [] as Array<{ name: string; score: number }>,
    recentActivity: [] as Array<{ action: string; author: string; time: number }>,
  },
};

function sortAndSlice(m: Map<string, number>) {
  return [...m.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

async function tryFetchPublicPosts(subredditName: string): Promise<any[]> {
  const methods = [
    { name: 'getHotPosts', fn: (reddit as any).getHotPosts },
    { name: 'getNewPosts', fn: (reddit as any).getNewPosts },
    { name: 'getTopPosts', fn: (reddit as any).getTopPosts },
  ];

  for (const method of methods) {
    if (typeof method.fn !== 'function') continue;

    try {
      const listing = method.fn.call(reddit, {
        subreddit: subredditName,
        limit: 100,
      });

      if (listing && typeof listing[Symbol.asyncIterator] === 'function') {
        const collected: any[] = [];
        for await (const post of listing) {
          collected.push(post);
          if (collected.length >= 100) break;
        }
        if (collected.length > 0) {
          log('community', 'info', 'Fetched posts via ' + method.name, {
            count: collected.length,
          });
          return collected;
        }
      }
    } catch (e) {
      log('community', 'warn', method.name + ' failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return [];
}

function extractTimestamp(raw: Record<string, unknown>): number {
  if (typeof raw.createdAt === 'number') return raw.createdAt;
  if (raw.createdAt instanceof Date) return (raw.createdAt as Date).getTime();
  if (typeof raw.created_utc === 'number') return (raw.created_utc as number) * 1000;
  return 0;
}

function extractAuthor(raw: Record<string, unknown>): string {
  if (typeof raw.authorName === 'string' && raw.authorName) return raw.authorName;
  if (typeof raw.author === 'string' && raw.author) return raw.author;
  return '';
}

function extractScore(raw: Record<string, unknown>): number {
  if (typeof raw.score === 'number') return raw.score;
  if (typeof (raw as any).upvotes === 'number') return (raw as any).upvotes;
  return 0;
}

function extractNumComments(raw: Record<string, unknown>): number {
  if (typeof raw.numComments === 'number') return raw.numComments;
  if (typeof raw.num_comments === 'number') return raw.num_comments;
  if (typeof raw.numberOfComments === 'number') return raw.numberOfComments;
  return 0;
}

function buildDataFromPosts(posts: any[]) {
  const postsByAuthor = new Map<string, number>();
  const karmaByAuthor = new Map<string, number>();
  const commentsByAuthor = new Map<string, number>();
  const activeAuthors = new Set<string>();

  for (const post of posts) {
    const raw = post as Record<string, unknown>;
    const author = extractAuthor(raw);
    if (!author || author === '[deleted]') continue;

    activeAuthors.add(author);
    postsByAuthor.set(author, (postsByAuthor.get(author) || 0) + 1);

    const score = extractScore(raw);
    const bestKarma = karmaByAuthor.get(author) || 0;
    if (score > bestKarma) karmaByAuthor.set(author, score);

    const numComments = extractNumComments(raw);
    if (numComments > 0) {
      commentsByAuthor.set(author, (commentsByAuthor.get(author) || 0) + numComments);
    }
  }

  const recentActivity = posts
    .slice()
    .sort((a, b) => {
      return extractTimestamp(b as Record<string, unknown>) - extractTimestamp(a as Record<string, unknown>);
    })
    .slice(0, 5)
    .map((p) => {
      const raw = p as Record<string, unknown>;
      return {
        action: 'post',
        author: extractAuthor(raw) || 'unknown',
        time: extractTimestamp(raw) || Date.now(),
      };
    });

  const postCount = posts.length;
  const health =
    postCount >= 50 ? 95 :
    postCount >= 20 ? 85 :
    postCount >= 10 ? 70 :
    postCount >= 5 ? 55 :
    30;

  return {
    success: true,
    data: {
      stats: {
        active: activeAuthors.size,
        posts: postCount,
        health,
      },
      contributors: sortAndSlice(postsByAuthor),
      commenters: sortAndSlice(commentsByAuthor),
      karma: sortAndSlice(karmaByAuthor),
      recentActivity,
    },
  };
}

async function buildFromStoredActions(): Promise<{
  success: boolean;
  data: any;
} | null> {
  try {
    const actionsKey = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
    const raw = await redis.get(actionsKey);
    if (!raw) return null;

    const actions: ModActionRecord[] = JSON.parse(raw as string);
    if (actions.length === 0) return null;

    const contributors = new Map<string, number>();
    const commenters = new Map<string, number>();
    const karma = new Map<string, number>();
    const activeAuthors = new Set<string>();
    const recentActivity: Array<{ action: string; author: string; time: number }> = [];

    for (const action of actions) {
      if (!action.targetAuthor || action.targetAuthor === '[deleted]') continue;

      const author = action.targetAuthor;
      activeAuthors.add(author);

      if (action.action === 'approve') {
        contributors.set(author, (contributors.get(author) || 0) + 1);
      }

      commenters.set(author, (commenters.get(author) || 0) + 1);
      karma.set(author, (karma.get(author) || 0) + 1);
    }

    const sortedByTime = [...actions]
      .filter((a) => a.targetAuthor && a.targetAuthor !== '[deleted]')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    for (const action of sortedByTime) {
      recentActivity.push({
        action: action.action,
        author: action.targetAuthor,
        time: action.timestamp,
      });
    }

    const totalAuthors = activeAuthors.size;
    const health =
      totalAuthors >= 10 ? 85 :
      totalAuthors >= 5 ? 70 :
      totalAuthors >= 2 ? 55 :
      30;

    log('community', 'info', 'Built from stored mod actions', {
      authors: totalAuthors,
      actions: actions.length,
    });

    return {
      success: true,
      data: {
        stats: {
          active: totalAuthors,
          posts: totalAuthors,
          health,
        },
        contributors: sortAndSlice(contributors),
        commenters: sortAndSlice(commenters),
        karma: sortAndSlice(karma),
        recentActivity,
      },
    };
  } catch (e) {
    log('community', 'warn', 'Failed to build from stored actions', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function buildFromQueueCache(): Promise<{
  success: boolean;
  data: any;
} | null> {
  try {
    const cacheKey = REDIS_KEYS.QUEUE_SNAPSHOT + context.subredditId;
    const cached = await getCached<any>(cacheKey, null);
    if (!cached || !cached.items || cached.items.length === 0) return null;

    const items = cached.items as Array<{
      authorName: string;
      type: string;
      reportCount: number;
      createdAt: number;
    }>;

    const contributors = new Map<string, number>();
    const commenters = new Map<string, number>();
    const karma = new Map<string, number>();
    const activeAuthors = new Set<string>();
    const recentActivity: Array<{ action: string; author: string; time: number }> = [];

    for (const item of items) {
      const author = item.authorName;
      if (!author || author === '[deleted]') continue;

      activeAuthors.add(author);
      contributors.set(author, (contributors.get(author) || 0) + 1);
      commenters.set(author, (commenters.get(author) || 0) + 1);
      karma.set(author, (karma.get(author) || 0) + item.reportCount);

      recentActivity.push({
        action: item.type,
        author,
        time: item.createdAt,
      });
    }

    recentActivity.sort((a, b) => b.time - a.time);
    const trimmed = recentActivity.slice(0, 5);

    const totalAuthors = activeAuthors.size;
    const health =
      totalAuthors >= 10 ? 85 :
      totalAuthors >= 5 ? 70 :
      totalAuthors >= 2 ? 55 :
      30;

    log('community', 'info', 'Built from queue cache', {
      authors: totalAuthors,
      items: items.length,
    });

    return {
      success: true,
      data: {
        stats: {
          active: totalAuthors,
          posts: totalAuthors,
          health,
        },
        contributors: sortAndSlice(contributors),
        commenters: sortAndSlice(commenters),
        karma: sortAndSlice(karma),
        recentActivity: trimmed,
      },
    };
  } catch (e) {
    log('community', 'warn', 'Failed to build from queue cache', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

community.get('/', async (c) => {
  try {
    const subredditName =
      c.req.query('subreddit') || context.subredditName || '';

    if (!subredditName) {
      return c.json({ success: false, error: 'Missing subreddit name' });
    }

    log('community', 'info', 'Fetching community data', { subredditName });

    const posts = await tryFetchPublicPosts(subredditName);

    if (posts.length > 0) {
      return c.json(buildDataFromPosts(posts));
    }

    log('community', 'info', 'Public posts empty, trying stored data', {
      subredditName,
    });

    const fromActions = await buildFromStoredActions();
    if (fromActions) return c.json(fromActions);

    const fromQueue = await buildFromQueueCache();
    if (fromQueue) return c.json(fromQueue);

    log('community', 'info', 'No data available yet', { subredditName });
    return c.json(EMPTY_DATA);
  } catch (error) {
    log('community', 'error', 'Fatal error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(EMPTY_DATA);
  }
});

export { community };
