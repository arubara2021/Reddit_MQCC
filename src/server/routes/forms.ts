// src/server/routes/forms.ts
import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { log } from '../core/logger';
import { banUser, removeAndBan, getDurationOptions } from '../core/modActions';

const forms = new Hono();

// ---- Single Ban Form ----
forms.post('/ban-user', async (c) => {
  try {
    const body = await c.req.json();
    const { username, reason, durationDays } = body;

    if (!username) {
      return c.json({ message: 'Missing username' }, 400);
    }

    log('forms', 'info', 'Ban user form submitted', {
      username,
      durationDays: durationDays || 0,
      reason: reason || 'Banned via MQCC',
    });

    const result = await banUser(
      username,
      reason || 'Banned via MQCC',
      durationDays
    );

    if (result.success) {
      return c.json({ success: true, message: result.message });
    }

    return c.json(
      { success: false, message: result.message },
      400
    );
  } catch (e) {
    log('forms', 'error', 'Ban user form failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ message: 'Ban failed' }, 500);
  }
});

// ---- Bulk Ban Form ----
forms.post('/bulk-ban', async (c) => {
  try {
    const body = await c.req.json();
    const { usernames, reason, durationDays } = body;

    if (!usernames || !Array.isArray(usernames)) {
      return c.json({ message: 'Missing usernames' }, 400);
    }

    log('forms', 'info', 'Bulk ban form submitted', {
      count: usernames.length,
      durationDays: durationDays || 0,
    });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const username of usernames) {
      try {
        const result = await banUser(
          username,
          reason || 'Bulk ban via MQCC',
          durationDays
        );
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(username + ': ' + result.message);
        }
      } catch (banErr) {
        failed++;
        errors.push(
          username +
            ': ' +
            (banErr instanceof Error ? banErr.message : String(banErr))
        );
      }
    }

    log('forms', 'info', 'Bulk ban complete', {
      success,
      failed,
    });

    return c.json({
      success: true,
      message: success + ' banned, ' + failed + ' failed',
      errors: errors.slice(0, 10),
    });
  } catch (e) {
    log('forms', 'error', 'Bulk ban form failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ message: 'Bulk ban failed' }, 500);
  }
});

// ---- Remove + Ban Form ----
forms.post('/remove-and-ban', async (c) => {
  try {
    const body = await c.req.json();
    const { fullname, username, reason, durationDays } = body;

    if (!fullname || !username) {
      return c.json({ message: 'Missing fullname or username' }, 400);
    }

    log('forms', 'info', 'Remove and ban form submitted', {
      fullname,
      username,
      durationDays: durationDays || 0,
    });

    const result = await removeAndBan(
      fullname,
      username,
      reason || 'Coordinated spam via MQCC',
      durationDays
    );

    if (result.success) {
      return c.json({ success: true, message: result.message });
    }

    return c.json(
      { success: false, message: result.message },
      400
    );
  } catch (e) {
    log('forms', 'error', 'Remove and ban form failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ message: 'Remove and ban failed' }, 500);
  }
});

// ---- Warn User Form ----
forms.post('/warn-user', async (c) => {
  try {
    const body = await c.req.json();
    const { username, message: warnMessage } = body;

    if (!username) {
      return c.json({ message: 'Missing username' }, 400);
    }

    log('forms', 'info', 'Warning recorded', {
      username,
      message: warnMessage,
    });

    return c.json({
      success: true,
      message: 'Warning recorded for u/' + username,
    });
  } catch (e) {
    log('forms', 'error', 'Warn user form failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ message: 'Warn failed' }, 500);
  }
});

// ---- Ban Duration Options ----
forms.get('/ban-durations', async (c) => {
  try {
    return c.json({ durations: getDurationOptions() });
  } catch (e) {
    return c.json({ durations: [] });
  }
});

export { forms };
