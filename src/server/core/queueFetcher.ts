import { reddit, context } from '@devvit/web/server';
import { REDIS_KEYS, TTL, MAX_QUEUE_ITEMS } from './constants';
import { setCached, getCached } from './cache';
import { log } from './logger';
import type { RawQueueItem, QueueSnapshot } from '../../shared/api';

function resolveFullname(item: Record<string, unknown>, isComment: boolean): string {
  const raw = item as Record<string, unknown>;

  if (typeof raw.fullname === 'string' && raw.fullname.length > 0) {
    return raw.fullname;
  }

  const id = String(item.id || '');
  if (id.startsWith('t1_') || id.startsWith('t3_')) {
    return id;
  }

  return isComment ? 't1_' + id : 't3_' + id;
}

function extractReportData(raw: Record<string, unknown>): {
  reasons: string[];
  count: number;
} {
  const reasons: string[] = [];
  let count = 0;

  const reportReasons = raw.reportReasons;
  if (Array.isArray(reportReasons)) {
    for (const r of reportReasons) {
      if (typeof r === 'string') {
        reasons.push(r);
      } else if (
        r &&
        typeof r === 'object' &&
        'reason' in (r as Record<string, unknown>)
      ) {
        reasons.push(String((r as Record<string, unknown>).reason));
      }
      count++;
    }
  }

  const modReports = raw.modReports;
  if (Array.isArray(modReports)) {
    for (const r of modReports) {
      if (typeof r === 'string') {
        reasons.push('[mod] ' + r);
      } else if (Array.isArray(r) && r.length > 0) {
        reasons.push('[mod] ' + String(r[0]));
      }
      count++;
    }
  }

  const numReports = raw.num_reports ?? raw.numReports;
  if (typeof numReports === 'number' && numReports > count) {
    count = numReports;
  }

  if (count === 0) count = 1;

  return { reasons, count };
}

function extractContent(
  raw: Record<string, unknown>
): { title: string; body: string } {
  let title = '';
  let body = '';

  if (typeof raw.title === 'string') title = raw.title;

  if (typeof raw.body === 'string') body = raw.body;
  if (!body && typeof raw.selftext === 'string') body = raw.selftext;
  if (!body && typeof raw.selfText === 'string') body = raw.selfText;
  if (!body && typeof raw.content === 'string') body = raw.content;
  if (!body && typeof raw.text === 'string') body = raw.text;

  if (!title && !body && typeof raw.url === 'string') {
    body = raw.url;
  }

  return { title, body };
}

export async function fetchModQueue(): Promise<RawQueueItem[]> {
  const subredditName = context.subredditName;
  if (!subredditName) {
    log('queueFetcher', 'warn', 'No subredditName in context');
    return [];
  }

  const cacheKey = REDIS_KEYS.QUEUE_SNAPSHOT + context.subredditId;

  try {
    const items: RawQueueItem[] = [];

    log('queueFetcher', 'info', 'Fetching mod queue', {
      subredditName,
      subredditId: context.subredditId,
    });

    let queue: any;
    try {
      queue = reddit.getModQueue({
        subreddit: subredditName,
        limit: MAX_QUEUE_ITEMS,
      } as any);
    } catch (queueErr) {
      log('queueFetcher', 'error', 'getModQueue failed', {
        error: queueErr instanceof Error ? queueErr.message : String(queueErr),
      });

      const cachedOnFail = await getCached<QueueSnapshot | null>(cacheKey, null);
      if (cachedOnFail && cachedOnFail.items.length > 0) {
        log('queueFetcher', 'info', 'Using cached snapshot after getModQueue failure', {
          count: cachedOnFail.items.length,
        });
        return cachedOnFail.items;
      }

      return [];
    }

    if (!queue || typeof queue[Symbol.asyncIterator] !== 'function') {
      log('queueFetcher', 'warn', 'Queue is not iterable', {
        type: typeof queue,
      });

      const cachedOnFail = await getCached<QueueSnapshot | null>(cacheKey, null);
      if (cachedOnFail && cachedOnFail.items.length > 0) {
        log('queueFetcher', 'info', 'Using cached snapshot after non-iterable queue', {
          count: cachedOnFail.items.length,
        });
        return cachedOnFail.items;
      }

      return [];
    }

    for await (const item of queue) {
      if (items.length >= MAX_QUEUE_ITEMS) break;

      try {
        const raw = item as unknown as Record<string, unknown>;
        const isComment = raw.body !== undefined && raw.title === undefined;
        const fullname = resolveFullname(raw, isComment);
        const { reasons, count } = extractReportData(raw);
        const { title, body } = extractContent(raw);

        items.push({
          id: String(item.id || ''),
          fullname,
          type: isComment ? 'comment' : 'post',
          title,
          body,
          authorName: item.authorName || '[deleted]',
          subredditName,
          createdAt: item.createdAt ? item.createdAt.getTime() : Date.now(),
          url: typeof raw.url === 'string' ? raw.url : '',
          permalink: typeof raw.permalink === 'string' ? raw.permalink : '',
          reportReasons: reasons,
          reportCount: count,
          isRemoved: false,
          isApproved: false,
          isLocked:
            typeof raw.isLocked === 'boolean' ? raw.isLocked : false,
        });
      } catch (itemErr) {
        log('queueFetcher', 'warn', 'Failed to process item', {
          error:
            itemErr instanceof Error ? itemErr.message : String(itemErr),
        });
      }
    }

    log('queueFetcher', 'info', 'Fetched queue', { count: items.length });

    if (items.length > 0) {
      const snapshot: QueueSnapshot = {
        items,
        timestamp: Date.now(),
        subredditId: context.subredditId || '',
      };
      await setCached(cacheKey, snapshot, TTL.QUEUE_SNAPSHOT_MS);
      return items;
    }

    const cachedSnapshot = await getCached<QueueSnapshot | null>(cacheKey, null);
    if (cachedSnapshot && cachedSnapshot.items.length > 0) {
      log('queueFetcher', 'info', 'Live queue empty, using cached snapshot', {
        count: cachedSnapshot.items.length,
      });
      return cachedSnapshot.items;
    }

    return items;
  } catch (e) {
    log('queueFetcher', 'error', 'Queue fetch failed', {
      error: e instanceof Error ? e.message : String(e),
    });

    const cached = await getCached<QueueSnapshot | null>(cacheKey, null);
    if (cached && cached.items.length > 0) {
      log('queueFetcher', 'info', 'Using cached queue fallback', {
        count: cached.items.length,
      });
      return cached.items;
    }

    return [];
  }
}

export function extractDomains(text: string): string[] {
  const domains: string[] = [];
  const regex = /https?:\/\/([^\s"'<>\])]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let host = match[1].toLowerCase().replace(/^www\./, '');
    const pathIdx = host.indexOf('/');
    if (pathIdx > 0) host = host.substring(0, pathIdx);
    const queryIdx = host.indexOf('?');
    if (queryIdx > 0) host = host.substring(0, queryIdx);
    const hashIdx = host.indexOf('#');
    if (hashIdx > 0) host = host.substring(0, hashIdx);
    if (host && host.length > 3 && !domains.includes(host)) {
      domains.push(host);
    }
  }
  return domains;
}

export function buildDomainAuthorMap(
  items: RawQueueItem[]
): Map<string, string[]> {
  const domainToAuthors = new Map<string, string[]>();

  for (const item of items) {
    const text = [item.body, item.url, item.title]
      .filter(Boolean)
      .join(' ');
    for (const domain of extractDomains(text)) {
      const authors = domainToAuthors.get(domain) || [];
      const authorLower = item.authorName.toLowerCase();
      if (!authors.includes(authorLower)) {
        authors.push(authorLower);
      }
      domainToAuthors.set(domain, authors);
    }
  }

  return domainToAuthors;
}

export function buildAuthorDomainMap(
  items: RawQueueItem[]
): Map<string, string[]> {
  const domainToAuthors = buildDomainAuthorMap(items);
  const authorDomains = new Map<string, string[]>();

  for (const [domain, authors] of domainToAuthors) {
    if (authors.length >= 2) {
      for (const author of authors) {
        const existing = authorDomains.get(author) || [];
        if (!existing.includes(domain)) {
          existing.push(domain);
        }
        authorDomains.set(author, existing);
      }
    }
  }

  return authorDomains;
}
