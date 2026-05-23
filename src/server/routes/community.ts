import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { log } from '../core/logger';
import { getLeaderboard, recordPost, isSeeded, markSeeded } from '../core/leaderboardTracker';
import { fetchModQueue } from '../core/queueFetcher';

const community = new Hono();

type Entry = { name: string; score: number };

type CommunityData = {
  stats: { active: number; posts: number; health: number };
  contributors: Entry[];
  commenters: Entry[];
  karma: Entry[];
  trendingPosts: Array<{
    title: string;
    permalink: string;
    author: string;
    numComments: number;
    createdAt: number;
    subreddit: string;
  }>;
  recentActivity: Array<{ action: string; author: string; time: number }>;
};

const EMPTY: CommunityData = {
  stats: { active: 0, posts: 0, health: 0 },
  contributors: [],
  commenters: [],
  karma: [],
  trendingPosts: [],
  recentActivity: [],
};

function sortSlice(m: Map<string, number>): Entry[] {
  return [...m.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function hasData(d: CommunityData): boolean {
  return (
    d.contributors.length > 0 ||
    d.commenters.length > 0 ||
    d.karma.length > 0 ||
    d.recentActivity.length > 0
  );
}

function buildFromQueueItems(
  items: Array<{
    id: string;
    authorName: string;
    type: 'post' | 'comment';
    title: string;
    body: string;
    createdAt: number;
    permalink: string;
  }>,
  sub: string
): CommunityData {
  const seen = new Set<string>();
  const unique: typeof items = [];

  for (const item of items) {
    if (!item.authorName || item.authorName === '[deleted]' || item.authorName === '[object Object]') continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  if (unique.length === 0) return EMPTY;

  const postsByAuthor = new Map<string, number>();
  const commentsByAuthor = new Map<string, number>();
  const activeAuthors = new Set<string>();

  for (const item of unique) {
    const a = item.authorName.toLowerCase();
    activeAuthors.add(a);
    postsByAuthor.set(a, (postsByAuthor.get(a) || 0) + 1);
    commentsByAuthor.set(a, (commentsByAuthor.get(a) || 0) + 1);
  }

  const sorted = [...unique].sort((a, b) => b.createdAt - a.createdAt);

  const recentActivity = sorted.slice(0, 5).map((r) => ({
    action: r.type || 'post',
    author: r.authorName,
    time: r.createdAt || Date.now(),
  }));

  const trendingPosts = sorted
    .filter((r) => r.title || r.body)
    .slice(0, 5)
    .map((r) => ({
      title: r.title || r.body?.substring(0, 80) || 'Untitled',
      permalink: r.permalink || '',
      author: r.authorName,
      numComments: 0,
      createdAt: r.createdAt,
      subreddit: sub,
    }));

  const n = unique.length;
  const health = n >= 50 ? 95 : n >= 20 ? 85 : n >= 10 ? 70 : n >= 5 ? 55 : 30;

  return {
    stats: { active: activeAuthors.size, posts: n, health },
    contributors: sortSlice(postsByAuthor),
    commenters: sortSlice(commentsByAuthor),
    karma: sortSlice(postsByAuthor),
    trendingPosts,
    recentActivity,
  };
}

async function seedFromQueue(): Promise<void> {
  try {
    const raw = await fetchModQueue();
    if (raw.length === 0) return;

    for (const item of raw) {
      if (!item.authorName || item.authorName === '[deleted]' || item.authorName === '[object Object]') continue;
      await recordPost(
        item.id,
        item.authorName,
        item.title || item.body?.substring(0, 80) || '',
        item.permalink || '',
        item.createdAt || Date.now()
      );
    }

    await markSeeded();
    log('community', 'info', 'Leaderboard seeded and marked', { count: raw.length });
  } catch (e) {
    log('community', 'warn', 'Seed from queue failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

community.get('/', async (c) => {
  try {
    const sub = c.req.query('subreddit') || context.subredditName || '';
    if (!sub) return c.json({ success: false, error: 'Missing subreddit name' });

    log('community', 'info', 'Fetching community data', { subredditName: sub });

    const seeded = await isSeeded();

    if (!seeded) {
      log('community', 'info', 'First visit, seeding leaderboard from queue');
      await seedFromQueue();
    }

    const data = await getLeaderboard(sub);

    if (hasData(data)) {
      log('community', 'info', 'Returning leaderboard data', {
        contributors: data.contributors.length,
        recentActivity: data.recentActivity.length,
      });
      return c.json({ success: true, data });
    }

    if (!seeded) {
      log('community', 'info', 'Seed produced no data, building direct fallback');
      try {
        const raw = await fetchModQueue();
        if (raw.length > 0) {
          const queueItems = raw.map((item) => ({
            id: item.id,
            authorName: item.authorName,
            type: item.type,
            title: item.title,
            body: item.body,
            createdAt: item.createdAt,
            permalink: item.permalink,
          }));
          const fallback = buildFromQueueItems(queueItems, sub);
          if (hasData(fallback)) {
            await markSeeded();
            log('community', 'info', 'Returning direct queue fallback', {
              contributors: fallback.contributors.length,
            });
            return c.json({ success: true, data: fallback });
          }
        }
      } catch (e) {
        log('community', 'warn', 'Direct fallback failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    log('community', 'info', 'No data available', { subredditName: sub });
    return c.json({ success: true, data: EMPTY });
  } catch (e) {
    log('community', 'error', 'Fatal error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: true, data: EMPTY });
  }
});

export { community };
