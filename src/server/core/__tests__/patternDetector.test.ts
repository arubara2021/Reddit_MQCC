// src/server/core/__tests__/patternDetector.test.ts

import { describe, it, expect } from 'vitest';
import { detectPatterns } from '../patternDetector';
import type { EnrichedQueueItem } from '../../../shared/api';

function makeItem(overrides: Partial<EnrichedQueueItem> = {}): EnrichedQueueItem {
  return {
    id: String(Math.random()),
    fullname: 't3_' + Math.random().toString(36).substring(2, 10),
    type: 'post',
    title: '',
    body: '',
    authorName: 'normaluser',
    subredditName: 'test',
    createdAt: Date.now(),
    url: '',
    permalink: '/r/test/comments/abc/',
    reportReasons: [],
    reportCount: 1,
    isRemoved: false,
    isApproved: false,
    isLocked: false,
    userContext: {
      username: 'normaluser',
      accountAgeDays: 365,
      totalKarma: 1000,
      postKarma: 500,
      commentKarma: 500,
      previousActionCount: 0,
      lastActionType: null,
      lastActionTimestamp: 0,
      queueAppearances: 0,
      isSuspended: false,
      isShadowbanned: false,
      cachedAt: Date.now(),
    },
    priority: {
      score: 10,
      level: 'low',
      factors: [],
    },
    ...overrides,
  };
}

describe('detectPatterns', () => {
  it('returns empty results for empty input', () => {
    const result = detectPatterns([]);
    expect(result.linkClusters).toHaveLength(0);
    expect(result.timeBursts).toHaveLength(0);
    expect(result.usernamePatterns).toHaveLength(0);
  });

  it('returns empty results for a single item', () => {
    const result = detectPatterns([makeItem()]);
    expect(result.linkClusters).toHaveLength(0);
    expect(result.timeBursts).toHaveLength(0);
    expect(result.usernamePatterns).toHaveLength(0);
  });

  describe('link cluster detection', () => {
    it('detects a cluster when 2 authors share a domain', () => {
      const items = [
        makeItem({ authorName: 'user_a', body: 'Check https://spam-site.xyz/page1' }),
        makeItem({ authorName: 'user_b', body: 'Visit https://spam-site.xyz/page2' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(1);
      expect(result.linkClusters[0].domain).toBe('spam-site.xyz');
      expect(result.linkClusters[0].uniqueAuthors).toHaveLength(2);
      expect(result.linkClusters[0].count).toBe(2);
    });

    it('detects a cluster when 3 or more authors share a domain', () => {
      const items = [
        makeItem({ authorName: 'spammer1', body: 'Go to https://scam-site.com/a' }),
        makeItem({ authorName: 'spammer2', body: 'Try https://scam-site.com/b' }),
        makeItem({ authorName: 'spammer3', body: 'Look https://scam-site.com/c' }),
        makeItem({ authorName: 'spammer4', body: 'See https://scam-site.com/d' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(1);
      expect(result.linkClusters[0].uniqueAuthors).toHaveLength(4);
      expect(result.linkClusters[0].count).toBe(4);
    });

    it('does not flag a domain used by only one author', () => {
      const items = [
        makeItem({ authorName: 'user1', body: 'https://normal-site.com/a' }),
        makeItem({ authorName: 'user1', body: 'https://normal-site.com/b' }),
        makeItem({ authorName: 'user1', body: 'https://normal-site.com/c' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(0);
    });

    it('detects domains from the url field', () => {
      const items = [
        makeItem({ authorName: 'user1', url: 'https://phish.net/page' }),
        makeItem({ authorName: 'user2', url: 'https://phish.net/other' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(1);
      expect(result.linkClusters[0].domain).toBe('phish.net');
    });

    it('detects domains from the title field', () => {
      const items = [
        makeItem({ authorName: 'user1', title: 'Visit https://promo.cc/now' }),
        makeItem({ authorName: 'user2', title: 'Check https://promo.cc/deal' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(1);
      expect(result.linkClusters[0].domain).toBe('promo.cc');
    });

    it('strips www. prefix from domains', () => {
      const items = [
        makeItem({ authorName: 'user1', body: 'https://www.example.com/1' }),
        makeItem({ authorName: 'user2', body: 'https://example.com/2' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(1);
      expect(result.linkClusters[0].domain).toBe('example.com');
    });

    it('detects multiple independent clusters', () => {
      const items = [
        makeItem({ authorName: 'a1', body: 'https://site-a.com/x' }),
        makeItem({ authorName: 'a2', body: 'https://site-a.com/y' }),
        makeItem({ authorName: 'b1', body: 'https://site-b.com/x' }),
        makeItem({ authorName: 'b2', body: 'https://site-b.com/y' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(2);
      const domains = result.linkClusters.map((c) => c.domain);
      expect(domains).toContain('site-a.com');
      expect(domains).toContain('site-b.com');
    });

    it('does not duplicate authors for the same domain', () => {
      const items = [
        makeItem({ authorName: 'user1', body: 'https://dup.com/1 https://dup.com/2' }),
        makeItem({ authorName: 'user2', body: 'https://dup.com/3' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(1);
      expect(result.linkClusters[0].uniqueAuthors).toHaveLength(2);
    });

    it('ignores items with no domains', () => {
      const items = [
        makeItem({ authorName: 'user1', body: 'No links here' }),
        makeItem({ authorName: 'user2', body: 'Also no links' }),
      ];
      const result = detectPatterns(items);
      expect(result.linkClusters).toHaveLength(0);
    });
  });

  describe('time burst detection', () => {
    it('does not trigger with fewer than 3 items', () => {
      const now = Date.now();
      const items = [
        makeItem({ authorName: 'u1', createdAt: now, userContext: { ...makeItem().userContext, accountAgeDays: 1 } }),
        makeItem({ authorName: 'u2', createdAt: now + 1000, userContext: { ...makeItem().userContext, accountAgeDays: 1 } }),
      ];
      const result = detectPatterns(items);
      expect(result.timeBursts).toHaveLength(0);
    });

    it('detects a burst when 3+ items appear within 1 hour from new accounts', () => {
      const now = Date.now();
      const items = [
        makeItem({
          authorName: 'newbot1',
          createdAt: now,
          userContext: { ...makeItem().userContext, username: 'newbot1', accountAgeDays: 1 },
        }),
        makeItem({
          authorName: 'newbot2',
          createdAt: now + 30000,
          userContext: { ...makeItem().userContext, username: 'newbot2', accountAgeDays: 2 },
        }),
        makeItem({
          authorName: 'newbot3',
          createdAt: now + 60000,
          userContext: { ...makeItem().userContext, username: 'newbot3', accountAgeDays: 100 },
        }),
      ];
      const result = detectPatterns(items);
      expect(result.timeBursts).toHaveLength(1);
      expect(result.timeBursts[0].count).toBe(3);
      expect(result.timeBursts[0].newAccountCount).toBe(2);
      expect(result.timeBursts[0].windowHours).toBe(1);
    });

    it('does not trigger a burst when all accounts are older than 7 days', () => {
      const now = Date.now();
      const items = [
        makeItem({
          authorName: 'olduser1',
          createdAt: now,
          userContext: { ...makeItem().userContext, username: 'olduser1', accountAgeDays: 100 },
        }),
        makeItem({
          authorName: 'olduser2',
          createdAt: now + 1000,
          userContext: { ...makeItem().userContext, username: 'olduser2', accountAgeDays: 200 },
        }),
        makeItem({
          authorName: 'olduser3',
          createdAt: now + 2000,
          userContext: { ...makeItem().userContext, username: 'olduser3', accountAgeDays: 300 },
        }),
      ];
      const result = detectPatterns(items);
      expect(result.timeBursts).toHaveLength(0);
    });

    it('does not trigger a burst when items span more than 1 hour', () => {
      const now = Date.now();
      const hourMs = 60 * 60 * 1000;
      const items = [
        makeItem({
          authorName: 'early1',
          createdAt: now,
          userContext: { ...makeItem().userContext, username: 'early1', accountAgeDays: 1 },
        }),
        makeItem({
          authorName: 'early2',
          createdAt: now + 1000,
          userContext: { ...makeItem().userContext, username: 'early2', accountAgeDays: 1 },
        }),
        makeItem({
          authorName: 'late1',
          createdAt: now + hourMs + 10000,
          userContext: { ...makeItem().userContext, username: 'late1', accountAgeDays: 1 },
        }),
      ];
      const result = detectPatterns(items);
      expect(result.timeBursts).toHaveLength(0);
    });
  });

  describe('username pattern detection', () => {
    it('detects name+numbers pattern with 3+ accounts', () => {
      const items = [
        makeItem({ authorName: 'bot1234' }),
        makeItem({ authorName: 'spam5678' }),
        makeItem({ authorName: 'fake9012' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'name+numbers');
      expect(match).toBeDefined();
      expect(match!.accounts).toHaveLength(3);
    });

    it('detects bot_ prefix pattern with 3+ accounts', () => {
      const items = [
        makeItem({ authorName: 'bot_alpha' }),
        makeItem({ authorName: 'bot_beta' }),
        makeItem({ authorName: 'bot_gamma' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'bot_ prefix');
      expect(match).toBeDefined();
      expect(match!.accounts).toHaveLength(3);
    });

    it('detects auto_ prefix pattern with 3+ accounts', () => {
      const items = [
        makeItem({ authorName: 'auto_post' }),
        makeItem({ authorName: 'auto_comment' }),
        makeItem({ authorName: 'auto_submit' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'auto_ prefix');
      expect(match).toBeDefined();
      expect(match!.accounts).toHaveLength(3);
    });

    it('detects repeated characters pattern with 3+ accounts', () => {
      const items = [
        makeItem({ authorName: 'aaaa_spam' }),
        makeItem({ authorName: 'bbbb_bot' }),
        makeItem({ authorName: 'cccc_fake' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'repeated characters');
      expect(match).toBeDefined();
      expect(match!.accounts).toHaveLength(3);
    });

    it('detects name_name pattern with 3+ accounts', () => {
      const items = [
        makeItem({ authorName: 'john_doe' }),
        makeItem({ authorName: 'jane_smith' }),
        makeItem({ authorName: 'bob_jones' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'name_name');
      expect(match).toBeDefined();
      expect(match!.accounts).toHaveLength(3);
    });

    it('does not flag a pattern with fewer than 3 matching accounts', () => {
      const items = [
        makeItem({ authorName: 'bot1234' }),
        makeItem({ authorName: 'spam5678' }),
        makeItem({ authorName: 'normaluser' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'name+numbers');
      expect(match).toBeUndefined();
    });

    it('treats usernames case-insensitively', () => {
      const items = [
        makeItem({ authorName: 'BOT1234' }),
        makeItem({ authorName: 'Spam5678' }),
        makeItem({ authorName: 'FAKE9012' }),
      ];
      const result = detectPatterns(items);
      const match = result.usernamePatterns.find((p) => p.pattern === 'name+numbers');
      expect(match).toBeDefined();
      expect(match!.accounts).toHaveLength(3);
    });
  });

  describe('combined patterns', () => {
    it('detects multiple pattern types simultaneously', () => {
      const now = Date.now();
      const items = [
        makeItem({
          authorName: 'bot1234',
          body: 'https://spam.xyz/1',
          createdAt: now,
          userContext: { ...makeItem().userContext, username: 'bot1234', accountAgeDays: 1 },
        }),
        makeItem({
          authorName: 'spam5678',
          body: 'https://spam.xyz/2',
          createdAt: now + 1000,
          userContext: { ...makeItem().userContext, username: 'spam5678', accountAgeDays: 2 },
        }),
        makeItem({
          authorName: 'fake9012',
          body: 'https://spam.xyz/3',
          createdAt: now + 2000,
          userContext: { ...makeItem().userContext, username: 'fake9012', accountAgeDays: 1 },
        }),
      ];
      const result = detectPatterns(items);

      expect(result.linkClusters.length).toBeGreaterThanOrEqual(1);
      expect(result.timeBursts.length).toBeGreaterThanOrEqual(1);
      expect(result.usernamePatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('handles items from diverse normal users without false positives', () => {
      const items = [
        makeItem({ authorName: 'Alice_Wonder', body: 'Great post about science' }),
        makeItem({ authorName: 'BobTheBuilder', body: 'I agree with this analysis' }),
        makeItem({ authorName: 'Charlie_Brown', body: 'Interesting perspective' }),
      ];
      const result = detectPatterns(items);

      expect(result.linkClusters).toHaveLength(0);
      expect(result.timeBursts).toHaveLength(0);
    });
  });
});
