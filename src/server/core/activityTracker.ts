import { redis, context } from '@devvit/web/server';
import { REDIS_KEYS, TTL } from './constants';
import { getCached, setCached } from './cache';
import { log } from './logger';
import type { ModActionRecord } from '../../shared/api';

interface WorkloadData {
  actionsByMod: Record<string, number>;
  actionsByType: Record<string, number>;
  actionsByHour: Record<string, number>;
  actionsByDay: Record<string, number>;
  recentActions: ModActionRecord[];
  totalActions: number;
  coverageGaps: Array<{
    day: string;
    hour: number;
    actionCount: number;
  }>;
  topFlaggedUsers: Array<{
    username: string;
    actionCount: number;
    lastAction: string;
  }>;
}

interface LeaderboardEntry {
  name: string;
  score: number;
}

interface LeaderboardData {
  contributors: LeaderboardEntry[];
  comments: LeaderboardEntry[];
  karma: LeaderboardEntry[];
}

export async function logActivity(record: ModActionRecord): Promise<void> {
  try {
    const key = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
    const raw = await redis.get(key);
    const actions: ModActionRecord[] = raw
      ? JSON.parse(raw as string)
      : [];

    actions.push(record);
    const trimmed = actions.slice(-500);

    await redis.set(key, JSON.stringify(trimmed), {
      expiration: new Date(Date.now() + TTL.MOD_ACTIONS_MS),
    });
  } catch (e) {
    log('activityTracker', 'warn', 'Failed to log activity', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function getWorkloadData(): Promise<WorkloadData> {
  const cacheKey = REDIS_KEYS.WORKLOAD + context.subredditId;
  const cached = await getCached<WorkloadData | null>(cacheKey, null);
  if (cached) return cached;

  const key = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
  const raw = await redis.get(key);
  const actions: ModActionRecord[] = raw
    ? JSON.parse(raw as string)
    : [];

  const actionsByMod: Record<string, number> = {};
  const actionsByType: Record<string, number> = {};
  const actionsByHour: Record<string, number> = {};
  const actionsByDay: Record<string, number> = {};
  const userActionCounts: Record<
    string,
    { count: number; lastTimestamp: number }
  > = {};

  for (const action of actions) {
    const mod = action.modName || 'unknown';
    actionsByMod[mod] = (actionsByMod[mod] || 0) + 1;

    actionsByType[action.action] = (actionsByType[action.action] || 0) + 1;

    const date = new Date(action.timestamp);
    const hour = date.getUTCHours();
    actionsByHour[String(hour)] = (actionsByHour[String(hour)] || 0) + 1;

    const days = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday',
    ];
    const day = days[date.getUTCDay()];
    actionsByDay[day] = (actionsByDay[day] || 0) + 1;

    if (action.targetAuthor) {
      const authorLower = action.targetAuthor.toLowerCase();
      if (!userActionCounts[authorLower]) {
        userActionCounts[authorLower] = {
          count: 0,
          lastTimestamp: 0,
        };
      }
      userActionCounts[authorLower].count++;
      if (action.timestamp > userActionCounts[authorLower].lastTimestamp) {
        userActionCounts[authorLower].lastTimestamp = action.timestamp;
      }
    }
  }

  const coverageGaps: WorkloadData['coverageGaps'] = [];
  const allDays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
  ];

  for (const day of allDays) {
    for (let hour = 0; hour < 24; hour++) {
      const key = String(hour);
      const count = actionsByHour[key] || 0;
      if (count === 0) {
        coverageGaps.push({ day, hour, actionCount: 0 });
      }
    }
  }

  const topFlaggedUsers = Object.entries(userActionCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([username, data]) => ({
      username,
      actionCount: data.count,
      lastAction: new Date(data.lastTimestamp).toISOString(),
    }));

  const workload: WorkloadData = {
    actionsByMod,
    actionsByType,
    actionsByHour,
    actionsByDay,
    recentActions: actions.slice(-50),
    totalActions: actions.length,
    coverageGaps: coverageGaps.slice(0, 20),
    topFlaggedUsers,
  };

  await setCached(cacheKey, workload, 5 * 60 * 1000);
  return workload;
}

export async function getLeaderboardData(
  timeRange: string
): Promise<LeaderboardData> {
  const cacheKey = REDIS_KEYS.WORKLOAD + context.subredditId + ':lb:' + timeRange;
  const cached = await getCached<LeaderboardData | null>(cacheKey, null);
  if (cached) return cached;

  const key = REDIS_KEYS.MOD_ACTIONS + context.subredditId;
  const raw = await redis.get(key);
  const actions: ModActionRecord[] = raw
    ? JSON.parse(raw as string)
    : [];

  const now = Date.now();
  let cutoff = 0;

  if (timeRange === 'week') {
    cutoff = now - 7 * 24 * 60 * 60 * 1000;
  } else if (timeRange === 'month') {
    cutoff = now - 30 * 24 * 60 * 60 * 1000;
  }

  const filtered = cutoff > 0
    ? actions.filter((a) => a.timestamp >= cutoff)
    : actions;

  const contributors: Record<string, number> = {};
  const comments: Record<string, number> = {};
  const karma: Record<string, number> = {};

  for (const action of filtered) {
    const author = action.targetAuthor;
    if (!author || author === '[deleted]') continue;

    if (action.action === 'approve') {
      contributors[author] = (contributors[author] || 0) + 1;
    }

    comments[author] = (comments[author] || 0) + 1;

    const bestKarma = karma[author] || 0;
    karma[author] = bestKarma + 1;
  }

  const sortAndSlice = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

  const leaderboard: LeaderboardData = {
    contributors: sortAndSlice(contributors),
    comments: sortAndSlice(comments),
    karma: sortAndSlice(karma),
  };

  const ttl = timeRange === 'week' ? 5 * 60 * 1000 : 15 * 60 * 1000;
  await setCached(cacheKey, leaderboard, ttl);

  log('activityTracker', 'info', 'Leaderboard built', {
    timeRange,
    contributors: leaderboard.contributors.length,
    commenters: leaderboard.comments.length,
    karmaLeaders: leaderboard.karma.length,
  });

  return leaderboard;
}
