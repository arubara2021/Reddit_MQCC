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
  const sources = [
    body.author,
    (body.post as Record<string, unknown>)?.author,
    (body.comment as Record<string, unknown>)?.author,
  ];

  for (const src of sources) {
    const name = toStr(src);
    if (name && name !== '[object Object]') return name;
  }

  const nested = (body.post as Record<string, unknown>)?.author ??
                 (body.comment as Record<string, unknown>)?.author ??
                 body.author;

  if (nested && typeof nested === 'object') {
    const obj = nested as Record<string, unknown>;
    const name = toStr(obj.name) || toStr(obj.username) || toStr(obj.displayName);
    if (name) return name;
  }

  return '';
}

function extractId(body: Record<string, unknown>): string {
  const post = (body.post || body.comment || body) as Record<string, unknown>;
  const val = post.id ?? body.id;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return '';
}

function extractTitle(body: Record<string, unknown>): string {
  const post = (body.post || body) as Record<string, unknown>;
  const val = post.title ?? body.title;
  return typeof val === 'string' ? val : '';
}

function extractPermalink(body: Record<string, unknown>): string {
  const post = (body.post || body.comment || body) as Record<string, unknown>;
  const val = post.permalink ?? body.permalink;
  return typeof val === 'string' ? val : '';
}

function extractPostId(body: Record<string, unknown>): string {
  const comment = (body.comment || body) as Record<string, unknown>;
  const val = comment.postId ?? comment.post_id ?? body.postId ?? body.post_id;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return '';
}

function extractTimestamp(body: Record<string, unknown>): number {
  const post = (body.post || body.comment || body) as Record<string, unknown>;
  const raw = post.created_utc ?? post.createdAt ?? post.created ??
              body.created_utc ?? body.createdAt ?? body.created;

  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000;
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  if (raw instanceof Date) return raw.getTime();
  return 0;
}

function isDeleted(author: string): boolean {
  return !author || author === '[deleted]' || author === '[object Object]';
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

    log('triggers', 'info', 'RAW on-post-submit', {
      keys: Object.keys(body),
      body: JSON.stringify(body).substring(0, 800),
    });

    const author = extractAuthor(body);
    const postId = extractId(body);
    const title = extractTitle(body);
    const permalink = extractPermalink(body);
    const createdAt = extractTimestamp(body) || Date.now();

    if (isDeleted(author)) {
      log('triggers', 'warn', 'on-post-submit: invalid author, skipping', {
        rawAuthor: JSON.stringify(
          (body.post as Record<string, unknown>)?.author || body.author
        ),
      });
      return c.json({ ok: true });
    }

    log('triggers', 'info', 'Post submitted', {
      postId,
      author,
      title: title.substring(0, 40),
    });

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

    log('triggers', 'info', 'RAW on-post-delete', {
      keys: Object.keys(body),
      body: JSON.stringify(body).substring(0, 800),
    });

    const author = extractAuthor(body);
    const postId = extractId(body);

    if (!postId) {
      return c.json({ ok: true });
    }

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

    log('triggers', 'info', 'RAW on-comment-submit', {
      keys: Object.keys(body),
      body: JSON.stringify(body).substring(0, 800),
    });

    const author = extractAuthor(body);
    const commentId = extractId(body);
    const postId = extractPostId(body);
    const createdAt = extractTimestamp(body) || Date.now();

    if (isDeleted(author)) {
      log('triggers', 'warn', 'on-comment-submit: invalid author, skipping', {
        rawAuthor: JSON.stringify(
          (body.comment as Record<string, unknown>)?.author || body.author
        ),
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

    log('triggers', 'info', 'RAW on-comment-delete', {
      keys: Object.keys(body),
      body: JSON.stringify(body).substring(0, 800),
    });

    const author = extractAuthor(body);
    const commentId = extractId(body);

    if (!commentId) {
      return c.json({ ok: true });
    }

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
