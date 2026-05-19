// src/server/core/__tests__/priorityScorer.test.ts

import { describe, it, expect } from 'vitest';
import { calculatePriority } from '../priorityScorer';
import type { RawQueueItem, UserContext } from '../../../shared/api';

function makeItem(overrides: Partial<RawQueueItem> = {}): RawQueueItem {
  return {
    id: 'test_1',
    fullname: 't3_test1',
    type: 'post',
    title: 'Test post',
    body: 'Test body',
    authorName: 'testuser',
    subredditName: 'test',
    createdAt: Date.now(),
    url: '',
    permalink: '/r/test/comments/abc/test_post/',
    reportReasons: [],
    reportCount: 1,
    isRemoved: false,
    isApproved: false,
    isLocked: false,
    ...overrides,
  };
}

function makeContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    username: 'testuser',
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
    ...overrides,
  };
}

describe('calculatePriority', () => {
  it('scores a well-established user with a single report as low', () => {
    const result = calculatePriority(makeItem(), makeContext());
    expect(result.score).toBe(8);
    expect(result.level).toBe('low');
    expect(result.factors).toHaveLength(0);
  });

  it('scores a brand new account with zero karma and multiple spam reports as critical', () => {
    const result = calculatePriority(
      makeItem({
        reportCount: 5,
        reportReasons: ['Spam', 'Bot account'],
      }),
      makeContext({
        accountAgeDays: 1,
        totalKarma: 0,
      })
    );
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.level).toBe('critical');
  });

  it('awards 25 points for account age less than 1 day', () => {
    const normal = calculatePriority(makeItem(), makeContext({ accountAgeDays: 365 }));
    const newborn = calculatePriority(makeItem(), makeContext({ accountAgeDays: 0 }));
    expect(newborn.score).toBe(normal.score + 25);
  });

  it('awards 20 points for account age between 1 and 6 days', () => {
    const normal = calculatePriority(makeItem(), makeContext({ accountAgeDays: 365 }));
    const young = calculatePriority(makeItem(), makeContext({ accountAgeDays: 3 }));
    expect(young.score).toBe(normal.score + 20);
  });

  it('awards 10 points for account age between 7 and 29 days', () => {
    const normal = calculatePriority(makeItem(), makeContext({ accountAgeDays: 365 }));
    const recent = calculatePriority(makeItem(), makeContext({ accountAgeDays: 14 }));
    expect(recent.score).toBe(normal.score + 10);
  });

  it('awards no account age points for accounts 30+ days old', () => {
    const result1 = calculatePriority(makeItem(), makeContext({ accountAgeDays: 30 }));
    const result2 = calculatePriority(makeItem(), makeContext({ accountAgeDays: 365 }));
    expect(result1.score).toBe(result2.score);
  });

  it('does not award account age points when accountAgeDays is -1 (unknown)', () => {
    const unknown = calculatePriority(makeItem(), makeContext({ accountAgeDays: -1 }));
    const established = calculatePriority(makeItem(), makeContext({ accountAgeDays: 365 }));
    expect(unknown.score).toBe(established.score);
  });

  it('awards 20 points for zero karma', () => {
    const normal = calculatePriority(makeItem(), makeContext({ totalKarma: 1000 }));
    const zero = calculatePriority(makeItem(), makeContext({ totalKarma: 0 }));
    expect(zero.score).toBe(normal.score + 20);
  });

  it('awards 15 points for karma between 1 and 9', () => {
    const normal = calculatePriority(makeItem(), makeContext({ totalKarma: 1000 }));
    const low = calculatePriority(makeItem(), makeContext({ totalKarma: 5 }));
    expect(low.score).toBe(normal.score + 15);
  });

  it('awards 5 points for karma between 10 and 49', () => {
    const normal = calculatePriority(makeItem(), makeContext({ totalKarma: 1000 }));
    const mid = calculatePriority(makeItem(), makeContext({ totalKarma: 25 }));
    expect(mid.score).toBe(normal.score + 5);
  });

  it('does not award karma points when totalKarma is -1 (unknown)', () => {
    const unknown = calculatePriority(makeItem(), makeContext({ totalKarma: -1 }));
    const high = calculatePriority(makeItem(), makeContext({ totalKarma: 1000 }));
    expect(unknown.score).toBe(high.score);
  });

  it('awards 15 points for 5+ queue appearances', () => {
    const normal = calculatePriority(makeItem(), makeContext({ queueAppearances: 0 }));
    const repeat = calculatePriority(makeItem(), makeContext({ queueAppearances: 5 }));
    expect(repeat.score).toBe(normal.score + 15);
  });

  it('awards 10 points for 3-4 queue appearances', () => {
    const normal = calculatePriority(makeItem(), makeContext({ queueAppearances: 0 }));
    const repeat = calculatePriority(makeItem(), makeContext({ queueAppearances: 3 }));
    expect(repeat.score).toBe(normal.score + 10);
  });

  it('awards 5 points for 2 queue appearances', () => {
    const normal = calculatePriority(makeItem(), makeContext({ queueAppearances: 0 }));
    const repeat = calculatePriority(makeItem(), makeContext({ queueAppearances: 2 }));
    expect(repeat.score).toBe(normal.score + 5);
  });

  it('awards 10 points for 3+ prior mod actions', () => {
    const normal = calculatePriority(makeItem(), makeContext({ previousActionCount: 0 }));
    const actioned = calculatePriority(makeItem(), makeContext({ previousActionCount: 3 }));
    expect(actioned.score).toBe(normal.score + 10);
  });

  it('awards 5 points for 1-2 prior mod actions', () => {
    const normal = calculatePriority(makeItem(), makeContext({ previousActionCount: 0 }));
    const actioned = calculatePriority(makeItem(), makeContext({ previousActionCount: 1 }));
    expect(actioned.score).toBe(normal.score + 5);
  });

  it('awards 15 bonus points for shadowbanned users', () => {
    const normal = calculatePriority(makeItem(), makeContext({ isShadowbanned: false }));
    const shadow = calculatePriority(makeItem(), makeContext({ isShadowbanned: true }));
    expect(shadow.score).toBe(normal.score + 15);
  });

  it('awards 15 bonus points for suspended users', () => {
    const normal = calculatePriority(makeItem(), makeContext({ isSuspended: false }));
    const suspended = calculatePriority(makeItem(), makeContext({ isSuspended: true }));
    expect(suspended.score).toBe(normal.score + 15);
  });

  it('stacks shadowbanned and suspended bonuses', () => {
    const normal = calculatePriority(makeItem(), makeContext());
    const both = calculatePriority(makeItem(), makeContext({ isShadowbanned: true, isSuspended: true }));
    expect(both.score).toBe(normal.score + 30);
  });

  it('detects spam keyword "spam" in report reasons', () => {
    const normal = calculatePriority(makeItem(), makeContext());
    const spam = calculatePriority(
      makeItem({ reportReasons: ['This is spam'] }),
      makeContext()
    );
    expect(spam.score).toBe(normal.score + 10);
    expect(spam.factors).toContain('Spam keyword: spam');
  });

  it('detects spam keyword "scam" in report reasons', () => {
    const normal = calculatePriority(makeItem(), makeContext());
    const scam = calculatePriority(
      makeItem({ reportReasons: ['Scam link'] }),
      makeContext()
    );
    expect(scam.score).toBe(normal.score + 10);
    expect(scam.factors).toContain('Spam keyword: scam');
  });

  it('detects spam keyword "bot" in report reasons', () => {
    const normal = calculatePriority(makeItem(), makeContext());
    const bot = calculatePriority(
      makeItem({ reportReasons: ['Bot account'] }),
      makeContext()
    );
    expect(bot.score).toBe(normal.score + 10);
    expect(bot.factors).toContain('Spam keyword: bot');
  });

  it('counts each report reason only once for spam keywords', () => {
    const normal = calculatePriority(makeItem(), makeContext());
    const multi = calculatePriority(
      makeItem({ reportReasons: ['Spam bot scam', 'Regular reason'] }),
      makeContext()
    );
    expect(multi.score).toBe(normal.score + 10);
  });

  it('counts multiple report reasons with different spam keywords separately', () => {
    const normal = calculatePriority(makeItem(), makeContext());
    const multi = calculatePriority(
      makeItem({ reportReasons: ['spam', 'phishing', 'clean reason'] }),
      makeContext()
    );
    expect(multi.score).toBe(normal.score + 20);
  });

  it('caps score at 100', () => {
    const result = calculatePriority(
      makeItem({
        reportCount: 20,
        reportReasons: ['spam', 'scam', 'phishing'],
      }),
      makeContext({
        accountAgeDays: 0,
        totalKarma: 0,
        isShadowbanned: true,
        isSuspended: true,
        queueAppearances: 10,
        previousActionCount: 5,
      })
    );
    expect(result.score).toBe(100);
    expect(result.level).toBe('critical');
  });

  it('assigns high level for scores between 55 and 79', () => {
    const result = calculatePriority(
      makeItem({ reportCount: 3 }),
      makeContext({ accountAgeDays: 5, totalKarma: 2 })
    );
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThan(80);
    expect(result.level).toBe('high');
  });

  it('assigns medium level for scores between 30 and 54', () => {
    const result = calculatePriority(
      makeItem({ reportCount: 2 }),
      makeContext({ accountAgeDays: 10, totalKarma: 30 })
    );
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThan(55);
    expect(result.level).toBe('medium');
  });

  it('assigns low level for scores below 30', () => {
    const result = calculatePriority(
      makeItem({ reportCount: 1 }),
      makeContext({ accountAgeDays: 365, totalKarma: 5000 })
    );
    expect(result.score).toBeLessThan(30);
    expect(result.level).toBe('low');
  });

  it('includes factor for 3+ reports', () => {
    const result = calculatePriority(
      makeItem({ reportCount: 4 }),
      makeContext()
    );
    expect(result.factors).toContain('4 reports');
  });

  it('limits factors array to 5 entries maximum', () => {
    const result = calculatePriority(
      makeItem({
        reportCount: 10,
        reportReasons: ['spam'],
      }),
      makeContext({
        accountAgeDays: 0,
        totalKarma: 0,
        isShadowbanned: true,
        isSuspended: true,
        queueAppearances: 5,
        previousActionCount: 3,
      })
    );
    expect(result.factors.length).toBeLessThanOrEqual(5);
  });

  it('always returns a valid priority level', () => {
    const levels = ['critical', 'high', 'medium', 'low'];
    const result = calculatePriority(makeItem(), makeContext());
    expect(levels).toContain(result.level);
  });

  it('handles comments the same as posts', () => {
    const post = calculatePriority(
      makeItem({ type: 'post', reportCount: 3 }),
      makeContext()
    );
    const comment = calculatePriority(
      makeItem({ type: 'comment', reportCount: 3 }),
      makeContext()
    );
    expect(post.score).toBe(comment.score);
  });
});
