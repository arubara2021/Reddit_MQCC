import { context } from '@devvit/web/server';
import { REDIS_KEYS, TTL } from './constants';
import { getCached, setCached } from './cache';
import { log } from './logger';

type LbPost = {
  id: string;
  title: string;
  permalink: string;
  createdAt: number;
};

type LbUser = {
  postCount: number;
  commentCount: number;
  totalActivity: number;
  recentPosts: LbPost[];
  lastActive: number;
};

type LbActivity = {
  action: string;
  author: string;
  time: number;
  postId: string;
};

type LbData = {
  users: Record<string, LbUser>;
  recentActivity: LbActivity[];
  lastUpdated: number;
};

const MAX_ACTIVITY = 100;
const MAX_RECENT_POSTS_PER_USER = 10;

function toStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.username === 'string') return obj.username;
    if (typeof obj.displayName === 'string') return obj.displayName;
  }
  return fallback;
}

function cleanName(raw: unknown): string {
  const name = toStr(raw, '');
  if (!name || name === '[object Object]' || name === '[deleted]') return '';
  return name;
}

function lbKey(): string {
  return REDIS_KEYS.LEADERBOARD + context.subredditId;
}

function seedKey(): string {
  return REDIS_KEYS.LEADERBOARD + 'seeded:' + context.subredditId;
}

async function load(): Promise<LbData> {
  return (await getCached<LbData | null>(lbKey(), null)) || {
    users: {},
    recentActivity: [],
    lastUpdated: 0,
  };
}

async function save(data: LbData): Promise<void> {
  data.lastUpdated = Date.now();
  await setCached(lbKey(), data, TTL.LEADERBOARD_MS);
}

export async function isSeeded(): Promise<boolean> {
  const val = await getCached<string | null>(seedKey(), null);
  return val === 'true';
}

export async function markSeeded(): Promise<void> {
  await setCached(seedKey(), 'true', TTL.LEADERBOARD_MS);
}

export async function recordPost(
  postId: string,
  author: unknown,
  title: string,
  permalink: string,
  createdAt: number
): Promise<void> {
  const authorName = cleanName(author);
  if (!authorName) return;

  const key = authorName.toLowerCase();
  try {
    const data = await load();

    for (const u of Object.values(data.users)) {
      for (const p of u.recentPosts) {
        if (p.id === postId) return;
      }
    }

    let user = data.users[key];
    if (!user) {
      user = { postCount: 0, commentCount: 0, totalActivity: 0, recentPosts: [], lastActive: 0 };
      data.users[key] = user;
    }

    user.recentPosts.push({ id: postId, title: title || '', permalink: permalink || '', createdAt: createdAt || Date.now() });
    if (user.recentPosts.length > MAX_RECENT_POSTS_PER_USER) {
      user.recentPosts = user.recentPosts.slice(-MAX_RECENT_POSTS_PER_USER);
    }

    user.postCount++;
    user.totalActivity++;
    user.lastActive = createdAt || Date.now();

    data.recentActivity.unshift({ action: 'post', author: authorName, time: user.lastActive, postId });
    data.recentActivity = data.recentActivity.slice(0, MAX_ACTIVITY);

    await save(data);
    log('leaderboardTracker', 'info', 'Post recorded', { author: authorName, postId, postCount: user.postCount });
  } catch (e) {
    log('leaderboardTracker', 'warn', 'recordPost failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function recordComment(
  commentId: string,
  postId: string,
  author: unknown,
  createdAt: number
): Promise<void> {
  const authorName = cleanName(author);
  if (!authorName) return;

  const key = authorName.toLowerCase();
  try {
    const data = await load();

    let user = data.users[key];
    if (!user) {
      user = { postCount: 0, commentCount: 0, totalActivity: 0, recentPosts: [], lastActive: 0 };
      data.users[key] = user;
    }

    user.commentCount++;
    user.totalActivity++;
    user.lastActive = createdAt || Date.now();

    data.recentActivity.unshift({ action: 'comment', author: authorName, time: user.lastActive, postId });
    data.recentActivity = data.recentActivity.slice(0, MAX_ACTIVITY);

    await save(data);
    log('leaderboardTracker', 'info', 'Comment recorded', { author: authorName, commentId, commentCount: user.commentCount });
  } catch (e) {
    log('leaderboardTracker', 'warn', 'recordComment failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function removePost(postId: string, author: unknown): Promise<void> {
  const authorName = cleanName(author);
  if (!authorName) return;

  const key = authorName.toLowerCase();
  try {
    const data = await load();
    const user = data.users[key];
    if (!user) return;

    const idx = user.recentPosts.findIndex((p) => p.id === postId);
    if (idx >= 0) {
      user.recentPosts.splice(idx, 1);
      if (user.postCount > 0) user.postCount--;
      if (user.totalActivity > 0) user.totalActivity--;
      user.lastActive = Date.now();
    }

    data.recentActivity = data.recentActivity.filter((a) => a.postId !== postId);

    await save(data);
    log('leaderboardTracker', 'info', 'Post removed', { author: authorName, postId });
  } catch (e) {
    log('leaderboardTracker', 'warn', 'removePost failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function removeComment(commentId: string, author: unknown): Promise<void> {
  const authorName = cleanName(author);
  if (!authorName) return;

  const key = authorName.toLowerCase();
  try {
    const data = await load();
    const user = data.users[key];
    if (!user) return;

    if (user.commentCount > 0) user.commentCount--;
    if (user.totalActivity > 0) user.totalActivity--;
    user.lastActive = Date.now();

    await save(data);
    log('leaderboardTracker', 'info', 'Comment removed', { author: authorName, commentId });
  } catch (e) {
    log('leaderboardTracker', 'warn', 'removeComment failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

type LeaderboardResult = {
  stats: { active: number; posts: number; health: number };
  contributors: Array<{ name: string; score: number }>;
  commenters: Array<{ name: string; score: number }>;
  karma: Array<{ name: string; score: number }>;
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

const EMPTY_RESULT: LeaderboardResult = {
  stats: { active: 0, posts: 0, health: 0 },
  contributors: [],
  commenters: [],
  karma: [],
  trendingPosts: [],
  recentActivity: [],
};

export async function getLeaderboard(sub: string): Promise<LeaderboardResult> {
  try {
    const data = await load();
    const users = data.users;
    const subName = sub || context.subredditName || 'unknown';

    const sortSlice = (entries: Array<{ name: string; score: number }>) =>
      entries.sort((a, b) => b.score - a.score).slice(0, 20);

    const contributors = sortSlice(
      Object.entries(users)
        .filter(([, u]) => u.postCount > 0)
        .map(([name, u]) => ({ name, score: u.postCount }))
    );

    const commenters = sortSlice(
      Object.entries(users)
        .filter(([, u]) => u.commentCount > 0)
        .map(([name, u]) => ({ name, score: u.commentCount }))
    );

    const karma = sortSlice(
      Object.entries(users)
        .filter(([, u]) => u.totalActivity > 0)
        .map(([name, u]) => ({ name, score: u.totalActivity }))
    );

    const recentActivity = data.recentActivity.slice(0, 5).map((a) => ({
      action: a.action,
      author: a.author,
      time: a.time,
    }));

    const allPosts: Array<{ post: LbPost; author: string }> = [];
    for (const [name, u] of Object.entries(users)) {
      for (const p of u.recentPosts) {
        allPosts.push({ post: p, author: name });
      }
    }
    allPosts.sort((a, b) => b.post.createdAt - a.post.createdAt);

    const trendingPosts = allPosts.slice(0, 5).map((item) => ({
      title: item.post.title || 'Untitled',
      permalink: item.post.permalink || '',
      author: item.author,
      numComments: 0,
      createdAt: item.post.createdAt,
      subreddit: subName,
    }));

    const activeCount = new Set(
      Object.keys(users).filter((k) => users[k].totalActivity > 0)
    ).size;
    const totalPosts = allPosts.length;
    const health =
      activeCount >= 20 ? 95 :
      activeCount >= 10 ? 85 :
      activeCount >= 5 ? 70 :
      activeCount >= 2 ? 55 : 30;

    return {
      stats: { active: activeCount, posts: totalPosts, health },
      contributors,
      commenters: commenters.length > 0 ? commenters : contributors,
      karma: karma.length > 0 ? karma : contributors,
      trendingPosts,
      recentActivity,
    };
  } catch (e) {
    log('leaderboardTracker', 'warn', 'getLeaderboard failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return EMPTY_RESULT;
  }
}
