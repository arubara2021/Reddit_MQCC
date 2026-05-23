import { Hono } from 'hono';
import { reddit, context } from '@devvit/web/server';
import { log } from '../core/logger';
import { addStoredMod } from '../core/permissions';
import {
  recordPost,
  recordComment,
  removePost,
  removeComment,
} from '../core/leaderboardTracker';

const triggers = new Hono();

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

function extractAuthor(body: Record<string, unknown>): string {
  const post = (body.post || body.comment || body) as Record<string, unknown>;

  const direct = toStr(post.author);
  if (direct) return direct;

  const nested = post.author;
  if (nested && typeof nested === 'object') {
    return toStr((nested as Record<string, unknown>).name) ||
           toStr((nested as Record<string, unknown>).username) || '';
  }

  const bodyAuthor = toStr(body.author);
  if (bodyAuthor) return bodyAuthor;

  return '';
}

function extractField(body: Record<string, unknown>, key: string): string {
  const post = (body.post || body.comment || body) as Record<string, unknown>;
  const val = post[key] ?? body[key];
  return typeof val === 'string' ? val : '';
}

function extractNumber(body: Record<string, unknown>, key: string): number {
  const post = (body.post || body.comment || body) as Record<string, unknown>;
  const val = post[key] ?? body[key];
  if (typeof val === 'number') return val > 1e12 ? val : val * 1000;
  return 0;
}

triggers.post('/on-install', async (c) => {
  try {
    const subredditName = context.subredditName;
    const subredditId = context.subredditId;

    log('triggers', 'info', 'App installed', { subredditName, subredditId });

    try {
      const installer = await reddit.getCurrentUsername();
      if (installer) {
        await addStoredMod(installer);
        log('triggers', 'info', 'Installer stored as mod', { installer, subredditName });
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

triggers.post('/on-post-submit', async (c) => {
  try {
    const body = await c.req.json();

    log('triggers', 'info', 'RAW on-post-submit body', {
      body: JSON.stringify(body).substring(0, 500),
    });

    const author = extractAuthor(body);
    const postId = extractField(body, 'id');
    const title = extractField(body, 'title');
    const permalink = extractField(body, 'permalink');
    const createdAt = extractNumber(body, 'created_utc') || Date.now();

    if (!author || author === '[deleted]' || author === '[object Object]') {
      log('triggers', 'warn', 'on-post-submit: bad author, skipping', {
        rawAuthor: JSON.stringify(body.post?.author || body.author),
      });
      return c.json({ ok: true });
    }

    log('triggers', 'info', 'Post submitted', { postId, author, title: title.substring(0, 40) });
    await recordPost(postId, author, title, permalink, createdAt);

    return c.json({ ok: true });
  } catch (e) {
    log('triggers', 'warn', 'on-post-submit failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ ok: true });
  }
});

triggers.post('/on-post-delete', async (c) => {
  try {
    const body = await c.req.json();

    log('triggers', 'info', 'RAW on-post-delete body', {
      body: JSON.stringify(body).substring(0, 500),
    });

    const author = extractAuthor(body);
    const postId = extractField(body, 'id');

    if (!postId) return c.json({ ok: true });

    log('triggers', 'info', 'Post deleted', { postId, author });
    await removePost(postId, author);

    return c.json({ ok: true });
  } catch (e) {
    log('triggers', 'warn', 'on-post-delete failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ ok: true });
  }
});

triggers.post('/on-comment-submit', async (c) => {
  try {
    const body = await c.req.json();

    log('triggers', 'info', 'RAW on-comment-submit body', {
      body: JSON.stringify(body).substring(0, 500),
    });

    const author = extractAuthor(body);
    const commentId = extractField(body, 'id');
    const postId = extractField(body, 'postId') || extractField(body, 'post_id');
    const createdAt = extractNumber(body, 'created_utc') || Date.now();

    if (!author || author === '[deleted]' || author === '[object Object]') {
      log('triggers', 'warn', 'on-comment-submit: bad author, skipping', {
        rawAuthor: JSON.stringify(body.comment?.author || body.author),
      });
      return c.json({ ok: true });
    }

    log('triggers', 'info', 'Comment submitted', { commentId, author });
    await recordComment(commentId, postId, author, createdAt);

    return c.json({ ok: true });
  } catch (e) {
    log('triggers', 'warn', 'on-comment-submit failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ ok: true });
  }
});

triggers.post('/on-comment-delete', async (c) => {
  try {
    const body = await c.req.json();

    log('triggers', 'info', 'RAW on-comment-delete body', {
      body: JSON.stringify(body).substring(0, 500),
    });

    const author = extractAuthor(body);
    const commentId = extractField(body, 'id');

    if (!commentId) return c.json({ ok: true });

    log('triggers', 'info', 'Comment deleted', { commentId, author });
    await removeComment(commentId, author);

    return c.json({ ok: true });
  } catch (e) {
    log('triggers', 'warn', 'on-comment-delete failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return c.json({ ok: true });
  }
});

export { triggers };
