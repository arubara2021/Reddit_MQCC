import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';
import { log } from '../core/logger';
import { community } from './community';
import { fetchModQueue } from '../core/queueFetcher';
import {
  enrichQueueItems,
  incrementQueueAppearance,
} from '../core/contextEnricher';
import { calculatePriority } from '../core/priorityScorer';
import { detectPatterns } from '../core/patternDetector';
import { detectAnomalies } from '../core/alertSystem';
import { getWorkloadData, getLeaderboardData } from '../core/activityTracker';
import {
  approveItem,
  removeItem,
  lockItem,
  banUser,
  removeAndBan,
  getDurationOptions,
} from '../core/modActions';
import { deleteCached } from '../core/cache';
import { REDIS_KEYS } from '../core/constants';
import { checkPermissions } from '../core/permissions';
import {
  getSettings,
  updateSettings,
  resetSettings,
} from '../core/settings';
import {
  checkActionRateLimit,
  checkBulkRateLimit,
} from '../core/rateLimiter';
import type {
  EnrichedQueueItem,
  ModPermissions,
  InitResponse,
} from '../../shared/api';

const api = new Hono();

api.route('/community', community);

const EMPTY_PERMISSIONS: ModPermissions = {
  canRemove: false,
  canBan: false,
  canApprove: false,
  canLock: false,
  canManageFlair: false,
  canAccessModLog: false,
  isMod: false,
};

const EMPTY_SETTINGS = {
  priorityWeights: {
    reportCount: 0.3,
    accountAge: 0.25,
    karma: 0.2,
    queueHistory: 0.15,
    modHistory: 0.1,
  },
  autoRefresh: false,
  refreshIntervalMs: 30000,
  groupSpamRings: true,
  enableAlerts: true,
  compactMode: false,
};

function fallbackUserContext(authorName: string) {
  return {
    username: authorName,
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
    cachedAt: Date.now(),
  };
}

async function clearQueueCache(): Promise<void> {
  try {
    await deleteCached(REDIS_KEYS.QUEUE_SNAPSHOT + context.subredditId);
  } catch (e) {
    log('api', 'warn', 'Failed to clear queue cache', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

api.get('/init', async (c) => {
  const subredditName = context.subredditName || 'unknown';
  const subredditId = context.subredditId || 'unknown';

  try {
    const { permissions, username } = await checkPermissions();
    const isMod = permissions.isMod === true;
    const verified = username !== null && username !== undefined;

    log('api', 'info', 'Init response', {
      subredditName,
      subredditId,
      username: username || 'anonymous',
      isMod,
      verified,
    });

    const response: InitResponse = {
      subredditName,
      subredditId,
      isMod,
      verified,
    };

    return c.json(response);
  } catch (e) {
    log('api', 'error', 'Init failed', {
      error: e instanceof Error ? e.message : String(e),
      subredditName,
    });

    return c.json({
      subredditName,
      subredditId,
      isMod: false,
      verified: false,
    });
  }
});

api.get('/permissions', async (c) => {
  try {
    const { permissions, username } = await checkPermissions();
    return c.json({ permissions, username });
  } catch (e) {
    log('api', 'error', 'Permissions check failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({
      permissions: EMPTY_PERMISSIONS,
      username: null,
    });
  }
});

api.get('/queue', async (c) => {
  try {
    const rawItems = await fetchModQueue();

    let contexts;
    try {
      contexts = await enrichQueueItems(rawItems);
    } catch (enrichErr) {
      log('api', 'warn', 'Enrichment failed, using defaults', {
        error: enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
      });
      contexts = rawItems.map((item) => fallbackUserContext(item.authorName));
    }

    const enriched: EnrichedQueueItem[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const userCtx = contexts[i];
      const priority = calculatePriority(rawItems[i], userCtx);

      try {
        await incrementQueueAppearance(rawItems[i].authorName);
      } catch (incErr) {
        log('api', 'warn', 'incrementQueueAppearance failed', {
          author: rawItems[i].authorName,
          error: incErr instanceof Error ? incErr.message : String(incErr),
        });
      }

      enriched.push({
        ...rawItems[i],
        userContext: userCtx,
        priority,
      });
    }

    enriched.sort((a, b) => b.priority.score - a.priority.score);

    let anomalies: Awaited<ReturnType<typeof detectAnomalies>> = [];
    try {
      anomalies = await detectAnomalies(enriched);
    } catch (anomalyErr) {
      log('api', 'warn', 'detectAnomalies failed in queue', {
        error: anomalyErr instanceof Error ? anomalyErr.message : String(anomalyErr),
      });
    }

    let patterns: ReturnType<typeof detectPatterns> = {
      linkClusters: [],
      timeBursts: [],
      usernamePatterns: [],
    };
    try {
      patterns = detectPatterns(enriched);
    } catch (patternErr) {
      log('api', 'warn', 'detectPatterns failed in queue', {
        error: patternErr instanceof Error ? patternErr.message : String(patternErr),
      });
    }

    return c.json({
      items: enriched,
      groups: [],
      lastUpdated: Date.now(),
      anomalies,
      patterns,
    });
  } catch (e) {
    log('api', 'error', 'Queue fetch failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({
      items: [],
      groups: [],
      lastUpdated: Date.now(),
      anomalies: [],
      patterns: { linkClusters: [], timeBursts: [], usernamePatterns: [] },
    });
  }
});

api.get('/anomalies', async (c) => {
  try {
    const rawItems = await fetchModQueue();

    let contexts;
    try {
      contexts = await enrichQueueItems(rawItems);
    } catch (enrichErr) {
      contexts = rawItems.map((item) => fallbackUserContext(item.authorName));
    }

    const enriched: EnrichedQueueItem[] = rawItems.map((item, i) => ({
      ...item,
      userContext: contexts[i],
      priority: calculatePriority(item, contexts[i]),
    }));

    let anomalies: Awaited<ReturnType<typeof detectAnomalies>> = [];
    try {
      anomalies = await detectAnomalies(enriched);
    } catch (anomalyErr) {
      log('api', 'warn', 'detectAnomalies failed', {
        error: anomalyErr instanceof Error ? anomalyErr.message : String(anomalyErr),
      });
      anomalies = [];
    }

    return c.json({ anomalies });
  } catch (e) {
    log('api', 'error', 'Anomaly check failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ anomalies: [] });
  }
});

api.get('/patterns', async (c) => {
  try {
    const rawItems = await fetchModQueue();

    let contexts;
    try {
      contexts = await enrichQueueItems(rawItems);
    } catch (enrichErr) {
      contexts = rawItems.map((item) => fallbackUserContext(item.authorName));
    }

    const enriched: EnrichedQueueItem[] = rawItems.map((item, i) => ({
      ...item,
      userContext: contexts[i],
      priority: calculatePriority(item, contexts[i]),
    }));

    const patterns = detectPatterns(enriched);
    return c.json({ patterns });
  } catch (e) {
    log('api', 'error', 'Pattern detection failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({
      patterns: {
        linkClusters: [],
        timeBursts: [],
        usernamePatterns: [],
      },
    });
  }
});

api.get('/workload', async (c) => {
  try {
    const workload = await getWorkloadData();
    return c.json({ workload });
  } catch (e) {
    log('api', 'error', 'Workload fetch failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ workload: null });
  }
});

api.get('/leaderboard', async (c) => {
  try {
    const timeRange = c.req.query('range') || 'week';
    const validRanges = ['week', 'month', 'all'];
    const range = validRanges.includes(timeRange) ? timeRange : 'week';

    const leaderboard = await getLeaderboardData(range);
    return c.json({ leaderboard });
  } catch (e) {
    log('api', 'error', 'Leaderboard fetch failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({
      leaderboard: {
        contributors: [],
        comments: [],
        karma: [],
      },
    });
  }
});

api.get('/settings', async (c) => {
  try {
    const settings = await getSettings();
    return c.json({ settings });
  } catch (e) {
    log('api', 'error', 'Settings fetch failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ settings: EMPTY_SETTINGS });
  }
});

api.post('/settings', async (c) => {
  try {
    const body = await c.req.json();
    const settings = await updateSettings(body);
    return c.json({ settings });
  } catch (e) {
    log('api', 'error', 'Settings update failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ settings: EMPTY_SETTINGS });
  }
});

api.post('/settings/reset', async (c) => {
  try {
    const settings = await resetSettings();
    return c.json({ settings });
  } catch (e) {
    log('api', 'error', 'Settings reset failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ settings: EMPTY_SETTINGS });
  }
});

api.get('/ban-durations', async (c) => {
  try {
    return c.json({ durations: getDurationOptions() });
  } catch (e) {
    return c.json({ durations: [] });
  }
});

api.post('/cleanup', async (c) => {
  try {
    const subredditId = context.subredditId;
    if (!subredditId) {
      return c.json({ success: false, message: 'No subreddit context' });
    }

    const keysToClear = [
      REDIS_KEYS.QUEUE_SNAPSHOT + subredditId,
      REDIS_KEYS.WORKLOAD + subredditId,
      REDIS_KEYS.ALERT_STATE + subredditId,
      REDIS_KEYS.ANOMALIES + subredditId,
      REDIS_KEYS.MOD_ACTIONS + subredditId,
      REDIS_KEYS.SETTINGS + subredditId,
      REDIS_KEYS.STORED_MODS + subredditId,
      REDIS_KEYS.SETUP_COMPLETE + subredditId,
      REDIS_KEYS.LEADERBOARD + subredditId,
      REDIS_KEYS.LEADERBOARD + 'seeded:' + subredditId,
    ];

    let cleared = 0;
    for (const key of keysToClear) {
      try {
        await deleteCached(key);
        cleared++;
      } catch (delErr) {
        log('api', 'warn', 'Failed to clear key', {
          key,
          error: delErr instanceof Error ? delErr.message : String(delErr),
        });
      }
    }

    log('api', 'info', 'Full cleanup complete', {
      subredditId,
      cleared,
      total: keysToClear.length,
    });

    return c.json({
      success: true,
      message: 'Cleared ' + cleared + ' cache keys including all historical data and leaderboard',
    });
  } catch (e) {
    log('api', 'error', 'Cleanup failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, message: 'Cleanup failed' });
  }
});

api.post('/action/approve', async (c) => {
  try {
    const body = await c.req.json();
    const { fullname, authorName } = body;

    if (!fullname) {
      return c.json({ message: 'Missing fullname' }, 400);
    }

    try {
      const rateCheck = await checkActionRateLimit('approve');
      if (!rateCheck.allowed) {
        return c.json({ message: 'Rate limit exceeded. Try again later.' }, 429);
      }
    } catch (rateErr) {
      log('api', 'warn', 'Rate limit check failed for approve', {
        error: rateErr instanceof Error ? rateErr.message : String(rateErr),
      });
    }

    log('api', 'info', 'Approving item', { fullname, authorName });
    const result = await approveItem(fullname, authorName);

    if (result.success) {
      await clearQueueCache();
    }

    return c.json({
      success: result.success,
      message: result.message,
    });
  } catch (e) {
    log('api', 'error', 'Approve failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, message: 'Approve failed' });
  }
});

api.post('/action/remove', async (c) => {
  try {
    const body = await c.req.json();
    const { fullname, authorName } = body;

    if (!fullname) {
      return c.json({ message: 'Missing fullname' }, 400);
    }

    try {
      const rateCheck = await checkActionRateLimit('remove');
      if (!rateCheck.allowed) {
        return c.json({ message: 'Rate limit exceeded. Try again later.' }, 429);
      }
    } catch (rateErr) {
      log('api', 'warn', 'Rate limit check failed for remove', {
        error: rateErr instanceof Error ? rateErr.message : String(rateErr),
      });
    }

    log('api', 'info', 'Removing item', { fullname, authorName });
    const result = await removeItem(fullname, authorName);

    if (result.success) {
      await clearQueueCache();
    }

    return c.json({
      success: result.success,
      message: result.message,
    });
  } catch (e) {
    log('api', 'error', 'Remove failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, message: 'Remove failed' });
  }
});

api.post('/action/lock', async (c) => {
  try {
    const body = await c.req.json();
    const { fullname, authorName } = body;

    if (!fullname) {
      return c.json({ message: 'Missing fullname' }, 400);
    }

    try {
      const rateCheck = await checkActionRateLimit('lock');
      if (!rateCheck.allowed) {
        return c.json({ message: 'Rate limit exceeded. Try again later.' }, 429);
      }
    } catch (rateErr) {
      log('api', 'warn', 'Rate limit check failed for lock', {
        error: rateErr instanceof Error ? rateErr.message : String(rateErr),
      });
    }

    log('api', 'info', 'Locking item', { fullname, authorName });
    const result = await lockItem(fullname, authorName);

    if (result.success) {
      await clearQueueCache();
    }

    return c.json({
      success: result.success,
      message: result.message,
    });
  } catch (e) {
    log('api', 'error', 'Lock failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, message: 'Lock failed' });
  }
});

api.post('/action/ban', async (c) => {
  try {
    const body = await c.req.json();
    const { username, reason, durationDays } = body;

    if (!username) {
      return c.json({ message: 'Missing username' }, 400);
    }

    try {
      const rateCheck = await checkActionRateLimit('ban');
      if (!rateCheck.allowed) {
        return c.json({ message: 'Rate limit exceeded. Try again later.' }, 429);
      }
    } catch (rateErr) {
      log('api', 'warn', 'Rate limit check failed for ban', {
        error: rateErr instanceof Error ? rateErr.message : String(rateErr),
      });
    }

    log('api', 'info', 'Banning user', {
      username,
      durationDays: durationDays || 0,
    });

    const result = await banUser(
      username,
      reason || 'Banned via MQCC',
      durationDays
    );

    if (result.success) {
      await clearQueueCache();
    }

    return c.json({
      success: result.success,
      message: result.message,
    });
  } catch (e) {
    log('api', 'error', 'Ban failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, message: 'Ban failed' });
  }
});

api.post('/action/removeAndBan', async (c) => {
  try {
    const body = await c.req.json();
    const { fullname, username, reason, durationDays } = body;

    if (!fullname || !username) {
      return c.json({ message: 'Missing fullname or username' }, 400);
    }

    try {
      const rateCheck = await checkActionRateLimit('removeAndBan');
      if (!rateCheck.allowed) {
        return c.json({ message: 'Rate limit exceeded. Try again later.' }, 429);
      }
    } catch (rateErr) {
      log('api', 'warn', 'Rate limit check failed for removeAndBan', {
        error: rateErr instanceof Error ? rateErr.message : String(rateErr),
      });
    }

    log('api', 'info', 'Remove and ban', { fullname, username });

    const result = await removeAndBan(
      fullname,
      username,
      reason || 'Coordinated spam via MQCC',
      durationDays
    );

    if (result.success) {
      await clearQueueCache();
    }

    return c.json({
      success: result.success,
      message: result.message,
    });
  } catch (e) {
    log('api', 'error', 'Remove and ban failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ success: false, message: 'Remove and ban failed' });
  }
});

api.post('/action/bulk', async (c) => {
  try {
    const body = await c.req.json();
    const { action, items, reason, durationDays } = body;

    if (!action || !items || !Array.isArray(items)) {
      return c.json({ message: 'Invalid bulk action request' }, 400);
    }

    try {
      const rateCheck = await checkBulkRateLimit('bulk');
      if (!rateCheck.allowed) {
        return c.json({ message: 'Rate limit exceeded. Try again later.' }, 429);
      }
    } catch (rateErr) {
      log('api', 'warn', 'Rate limit check failed for bulk', {
        error: rateErr instanceof Error ? rateErr.message : String(rateErr),
      });
    }

    log('api', 'info', 'Bulk action started', {
      action,
      count: items.length,
      durationDays: durationDays || 0,
    });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        let result;

        switch (action) {
          case 'approve':
            result = await approveItem(item.fullname, item.authorName);
            break;
          case 'remove':
            result = await removeItem(item.fullname, item.authorName);
            break;
          case 'ban':
            result = await banUser(
              item.authorName,
              reason || 'Banned via MQCC',
              durationDays
            );
            break;
          case 'removeAndBan':
            result = await removeAndBan(
              item.fullname,
              item.authorName,
              reason || 'Coordinated spam via MQCC',
              durationDays
            );
            break;
          default:
            result = {
              success: false,
              message: 'Unknown action: ' + action,
            };
        }

        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(item.authorName + ': ' + result.message);
        }
      } catch (itemErr) {
        failed++;
        errors.push(
          item.authorName +
            ': ' +
            (itemErr instanceof Error ? itemErr.message : String(itemErr))
        );
      }
    }

    await clearQueueCache();

    log('api', 'info', 'Bulk action complete', {
      action,
      success,
      failed,
    });

    return c.json({
      result: {
        success,
        failed,
        errors: errors.slice(0, 10),
      },
    });
  } catch (e) {
    log('api', 'error', 'Bulk action failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({
      result: { success: 0, failed: 0, errors: ['Bulk action failed'] },
    });
  }
});

export { api };
