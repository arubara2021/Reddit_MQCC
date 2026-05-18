import { Hono } from 'hono';
import { redis, context } from '@devvit/web/server';
import { REDIS_KEYS, TTL } from '../core/constants';
import { log } from '../core/logger';
import type { ModActionRecord, RawQueueItem } from '../../shared/api';

const seed = new Hono();

const TEST_AUTHORS = [
  'SpamBot_01',
  'SpamBot_02',
  'SpamBot_03',
  'NewAccount_99',
  'SuspiciousUser',
  'LinkSpammer42',
  'AutoPost_bot',
  'CoolContributor',
  'HelpfulHannah',
  'RegularUser',
  'TopPoster',
  'CommentKing',
  'MemeLord_2026',
  'DataCruncher',
  'NightOwl',
];

const TEST_MODS = ['lettuce_be_lettuce', 'Extras0', 'AutoModerator'];

const SPAM_DOMAINS = ['spam-site.xyz', 'free-crypto.biz', 'click-here.cc'];

const REPORT_REASONS = [
  'Spam',
  'This is spam',
  'Self-promotion',
  'Bot account',
  'Scam link',
  'Breaks subreddit rules',
  'Harassment',
  'Misinformation',
  'Repost',
  'Low quality',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateModActions(): ModActionRecord[] {
  const actions: ModActionRecord[] = [];
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < 100; i++) {
    const timestamp = randomInt(thirtyDaysAgo, now);
    const author = randomItem(TEST_AUTHORS);
    const mod = randomItem(TEST_MODS);
    const actionType = randomItem(['approve', 'remove', 'ban', 'approve', 'approve', 'remove'] as const);

    actions.push({
      action: actionType as ModActionRecord['action'],
      targetAuthor: author,
      targetId: 't3_' + Math.random().toString(36).substring(2, 10),
      reason: actionType === 'ban' ? 'Spam via MQCC' : null,
      modName: mod,
      timestamp,
    });
  }

  actions.sort((a, b) => a.timestamp - b.timestamp);
  return actions;
}

function generateQueueItems(): RawQueueItem[] {
  const items: RawQueueItem[] = [];
  const now = Date.now();

  for (let i = 0; i < 25; i++) {
    const author = randomItem(TEST_AUTHORS);
    const isPost = Math.random() > 0.3;
    const reportCount = randomInt(1, 8);
    const reasonSlice: string[] = [];
    for (let r = 0; r < Math.min(reportCount, 3); r++) {
      reasonSlice.push(randomItem(REPORT_REASONS));
    }

    const hoursAgo = randomInt(0, 48);
    const createdAt = now - hoursAgo * 60 * 60 * 1000;

    const hasSpamLink = Math.random() > 0.6;
    const domain = hasSpamLink ? randomItem(SPAM_DOMAINS) : '';

    items.push({
      id: 'test_' + i + '_' + Math.random().toString(36).substring(2, 8),
      fullname: (isPost ? 't3_' : 't1_') + Math.random().toString(36).substring(2, 10),
      type: isPost ? 'post' : 'comment',
      title: isPost ? 'Test post ' + (i + 1) + ' by u/' + author : '',
      body: isPost
        ? (hasSpamLink ? 'Check out https://' + domain + '/deal' : 'This is a test post body for ' + author)
        : 'Test comment ' + (i + 1) + ' by u/' + author,
      authorName: author,
      subredditName: context.subredditName || 'test',
      createdAt,
      url: hasSpamLink ? 'https://' + domain + '/deal' : '',
      permalink: '/r/test/comments/abc' + i + '/test_post/',
      reportReasons: reasonSlice,
      reportCount,
      isRemoved: false,
      isApproved: false,
      isLocked: false,
    });
  }

  return items;
}

function generateQueueAppearances(): Array<{ username: string; count: number }> {
  return TEST_AUTHORS.map((author) => ({
    username: author.toLowerCase(),
    count: randomInt(0, 12),
  }));
}

seed.post('/', async (c) => {
  try {
    const subredditId = context.subredditId;
    if (!subredditId) {
      return c.json({ success: false, error: 'No subreddit context' });
    }

    log('seed', 'info', 'Starting seed data generation', { subredditId });

    const actions = generateModActions();
    const actionsKey = REDIS_KEYS.MOD_ACTIONS + subredditId;
    await redis.set(actionsKey, JSON.stringify(actions), {
      expiration: new Date(Date.now() + TTL.MOD_ACTIONS_MS),
    });
    log('seed', 'info', 'Seeded mod actions', { count: actions.length });

    const queueItems = generateQueueItems();
    const queueKey = REDIS_KEYS.QUEUE_SNAPSHOT + subredditId;
    await redis.set(
      queueKey,
      JSON.stringify({
        items: queueItems,
        timestamp: Date.now(),
        subredditId,
      }),
      {
        expiration: new Date(Date.now() + TTL.QUEUE_SNAPSHOT_MS * 10),
      }
    );
    log('seed', 'info', 'Seeded queue items', { count: queueItems.length });

    const appearances = generateQueueAppearances();
    for (const entry of appearances) {
      if (entry.count > 0) {
        const appearKey = REDIS_KEYS.QUEUE_APPEARANCES + entry.username;
        await redis.set(appearKey, String(entry.count), {
          expiration: new Date(Date.now() + TTL.APPEARANCES_MS),
        });
      }
    }
    log('seed', 'info', 'Seeded queue appearances', {
      count: appearances.filter((a) => a.count > 0).length,
    });

    const uniqueAuthors = new Set(actions.map((a) => a.targetAuthor));
    const uniqueMods = new Set(actions.map((a) => a.modName));

    return c.json({
      success: true,
      message: 'Seed data generated successfully',
      data: {
        actions: actions.length,
        queueItems: queueItems.length,
        uniqueAuthors: uniqueAuthors.size,
        uniqueMods: uniqueMods.size,
        appearances: appearances.filter((a) => a.count > 0).length,
      },
    });
  } catch (e) {
    log('seed', 'error', 'Seed failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({
      success: false,
      error: e instanceof Error ? e.message : 'Seed failed',
    });
  }
});

seed.post('/clear', async (c) => {
  try {
    const subredditId = context.subredditId;
    if (!subredditId) {
      return c.json({ success: false, error: 'No subreddit context' });
    }

    const keys = [
      REDIS_KEYS.MOD_ACTIONS + subredditId,
      REDIS_KEYS.QUEUE_SNAPSHOT + subredditId,
      REDIS_KEYS.WORKLOAD + subredditId,
      REDIS_KEYS.ANOMALIES + subredditId,
    ];

    for (const key of keys) {
      try {
        await redis.del(key);
      } catch {}
    }

    for (const author of TEST_AUTHORS) {
      try {
        await redis.del(REDIS_KEYS.QUEUE_APPEARANCES + author.toLowerCase());
      } catch {}
    }

    log('seed', 'info', 'Seed data cleared', { subredditId });

    return c.json({ success: true, message: 'Seed data cleared' });
  } catch (e) {
    log('seed', 'error', 'Clear failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, error: 'Clear failed' });
  }
});

export { seed };
