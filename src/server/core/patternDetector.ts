// src/server/core/patternDetector.ts
import type { EnrichedQueueItem, PatternResult } from '../../shared/api';
import { extractDomains } from './queueFetcher';
import { log } from './logger';

export function detectPatterns(items: EnrichedQueueItem[]): PatternResult {
  const result: PatternResult = {
    linkClusters: [],
    timeBursts: [],
    usernamePatterns: [],
  };

  if (items.length === 0) return result;

  detectLinkClusters(items, result);
  detectTimeBursts(items, result);
  detectUsernamePatterns(items, result);

  log('patternDetector', 'info', 'Pattern detection complete', {
    linkClusters: result.linkClusters.length,
    timeBursts: result.timeBursts.length,
    usernamePatterns: result.usernamePatterns.length,
  });

  return result;
}

function detectLinkClusters(
  items: EnrichedQueueItem[],
  result: PatternResult
): void {
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

  for (const [domain, authors] of domainToAuthors) {
    if (authors.length >= 2) {
      result.linkClusters.push({
        domain,
        count: authors.length,
        uniqueAuthors: authors,
      });
    }
  }
}

function detectTimeBursts(
  items: EnrichedQueueItem[],
  result: PatternResult
): void {
  if (items.length < 3) return;

  const windowMs = 60 * 60 * 1000; // 1 hour
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const processed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (processed.has(i)) continue;

    const windowEnd = sorted[i].createdAt + windowMs;
    const burstIndices: number[] = [i];

    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].createdAt <= windowEnd) {
        burstIndices.push(j);
      } else {
        break;
      }
    }

    if (burstIndices.length >= 3) {
      const burstItems = burstIndices.map((idx) => sorted[idx]);
      const newAccounts = burstItems.filter(
        (item) =>
          item.userContext.accountAgeDays >= 0 &&
          item.userContext.accountAgeDays < 7
      );

      if (newAccounts.length >= 2) {
        result.timeBursts.push({
          count: burstItems.length,
          windowHours: 1,
          newAccountCount: newAccounts.length,
        });

        for (const idx of burstIndices) {
          processed.add(idx);
        }
      }
    }
  }
}

function detectUsernamePatterns(
  items: EnrichedQueueItem[],
  result: PatternResult
): void {
  const authors = [
    ...new Set(items.map((i) => i.authorName.toLowerCase())),
  ];

  const patterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /([a-z]+)\d{2,4}$/i, label: 'name+numbers' },
    { regex: /^([a-z]+)_([a-z]+)/i, label: 'name_name' },
    { regex: /^auto_/i, label: 'auto_ prefix' },
    { regex: /^bot_/i, label: 'bot_ prefix' },
    { regex: /(\w)\1{3,}/, label: 'repeated characters' },
  ];

  for (const { regex, label } of patterns) {
    const matches = authors.filter((a) => regex.test(a));
    if (matches.length >= 3) {
      result.usernamePatterns.push({
        pattern: label,
        accounts: matches,
      });
    }
  }
}
