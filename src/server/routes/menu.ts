import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { log } from '../core/logger';
import { createDashboardPost } from '../core/post';

const menu = new Hono();

menu.post('/create-post', async (c) => {
  try {
    const subredditName = context.subredditName;

    log('menu', 'info', 'Create post menu triggered', {
      subredditName,
    });

    const result = await createDashboardPost();

    if (result.postId) {
      log('menu', 'info', 'Dashboard post created', {
        postId: result.postId,
      });
    } else {
      log('menu', 'warn', 'Post creation returned no ID', {
        error: result.error,
      });
    }

    return c.json({});
  } catch (e) {
    log('menu', 'error', 'Menu action failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({});
  }
});

export { menu };
