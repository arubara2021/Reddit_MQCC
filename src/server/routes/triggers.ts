import { Hono } from 'hono';
import { reddit, context } from '@devvit/web/server';
import { log } from '../core/logger';
import { addStoredMod } from '../core/permissions';

const triggers = new Hono();

triggers.post('/on-install', async (c) => {
  try {
    const subredditName = context.subredditName;
    const subredditId = context.subredditId;

    log('triggers', 'info', 'App installed', {
      subredditName,
      subredditId,
    });

    try {
      const installer = await reddit.getCurrentUsername();

      if (installer) {
        await addStoredMod(installer);
        log('triggers', 'info', 'Installer stored as mod', {
          installer,
          subredditName,
        });
      } else {
        log('triggers', 'warn', 'Could not get installer username');
      }
    } catch (modErr) {
      log('triggers', 'warn', 'Failed to store installer as mod', {
        error: modErr instanceof Error ? modErr.message : String(modErr),
      });
    }

    return c.json({ success: true });
  } catch (e) {
    log('triggers', 'error', 'Install trigger failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ message: 'Install trigger failed' }, 500);
  }
});

export { triggers };
