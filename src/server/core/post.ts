// src/server/core/post.ts
import { reddit, context } from '@devvit/web/server';
import { log } from './logger';

export async function createDashboardPost(): Promise<{
  postId: string | null;
  error: string | null;
}> {
  const subredditName = context.subredditName;

  if (!subredditName) {
    return { postId: null, error: 'No subreddit context' };
  }

  try {
    log('post', 'info', 'Creating dashboard post', { subredditName });

    const post = await (reddit as any).submitCustomPost({
      subredditName,
      title: 'MQCC — Mod Queue Command Center',
      text: 'Open this post to access the moderation dashboard.',
      flairId: undefined,
      flairText: 'Tool',
    });

    if (post && post.id) {
      log('post', 'info', 'Dashboard post created', {
        postId: post.id,
        subredditName,
      });
      return { postId: post.id, error: null };
    }

    log('post', 'warn', 'Post created but no ID returned');
    return { postId: null, error: 'Post created but no ID returned' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('post', 'error', 'Failed to create dashboard post', {
      error: msg,
    });
    return { postId: null, error: msg };
  }
}

export async function getExistingDashboardPost(): Promise<string | null> {
  try {
    const subredditName = context.subredditName;
    if (!subredditName) return null;

    // Search recent posts by the app for an existing dashboard
    const posts = (reddit as any).getHotPosts({
      subreddit: subredditName,
      limit: 25,
    });

    if (posts && typeof posts[Symbol.asyncIterator] === 'function') {
      for await (const post of posts) {
        if (
          post.title &&
          post.title.includes('MQCC') &&
          post.title.includes('Mod Queue Command Center')
        ) {
          return post.id;
        }
      }
    }

    return null;
  } catch (e) {
    log('post', 'warn', 'Failed to search for existing post', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
