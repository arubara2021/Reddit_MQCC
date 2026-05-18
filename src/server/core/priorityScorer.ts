// src/server/core/priorityScorer.ts
import type { RawQueueItem, UserContext, PriorityScore } from '../../shared/api';

export function calculatePriority(
  item: RawQueueItem,
  userContext: UserContext
): PriorityScore {
  let score = 0;
  const factors: string[] = [];

  // Report weight (0-25)
  const reportScore = Math.min(item.reportCount * 8, 25);
  score += reportScore;
  if (item.reportCount >= 3) {
    factors.push(item.reportCount + ' reports');
  }

  // Account age weight (0-25)
  if (userContext.accountAgeDays >= 0 && userContext.accountAgeDays < 1) {
    score += 25;
    factors.push('Account < 1 day old');
  } else if (
    userContext.accountAgeDays >= 0 &&
    userContext.accountAgeDays < 7
  ) {
    score += 20;
    factors.push('Account < 7 days old');
  } else if (
    userContext.accountAgeDays >= 0 &&
    userContext.accountAgeDays < 30
  ) {
    score += 10;
    factors.push('Account < 30 days old');
  }

  // Karma weight (0-20)
  if (userContext.totalKarma >= 0 && userContext.totalKarma < 1) {
    score += 20;
    factors.push('Zero karma');
  } else if (userContext.totalKarma >= 0 && userContext.totalKarma < 10) {
    score += 15;
    factors.push('Karma < 10');
  } else if (userContext.totalKarma >= 0 && userContext.totalKarma < 50) {
    score += 5;
    factors.push('Karma < 50');
  }

  // Queue history weight (0-15)
  if (userContext.queueAppearances >= 5) {
    score += 15;
    factors.push(
      'Repeated in queue (' + userContext.queueAppearances + 'x)'
    );
  } else if (userContext.queueAppearances >= 3) {
    score += 10;
    factors.push('Appeared ' + userContext.queueAppearances + ' times');
  } else if (userContext.queueAppearances >= 2) {
    score += 5;
  }

  // Prior mod action weight (0-10)
  if (userContext.previousActionCount >= 3) {
    score += 10;
    factors.push(userContext.previousActionCount + ' prior mod actions');
  } else if (userContext.previousActionCount >= 1) {
    score += 5;
    factors.push('Previously actioned');
  }

  // Shadowbanned/suspended bonus (0-15)
  if (userContext.isShadowbanned) {
    score += 15;
    factors.push('Shadowbanned');
  }
  if (userContext.isSuspended) {
    score += 15;
    factors.push('Suspended');
  }

  // Spam keyword detection in report reasons (0-10)
  const spamKeywords = [
    'spam',
    'scam',
    'phishing',
    'bot',
    'self-promotion',
  ];
  for (const reason of item.reportReasons) {
    const lower = reason.toLowerCase();
    for (const keyword of spamKeywords) {
      if (lower.includes(keyword)) {
        score += 10;
        factors.push('Spam keyword: ' + keyword);
        break;
      }
    }
  }

  // Cap at 100
  score = Math.min(score, 100);

  let level: PriorityScore['level'];
  if (score >= 80) level = 'critical';
  else if (score >= 55) level = 'high';
  else if (score >= 30) level = 'medium';
  else level = 'low';

  return { score, level, factors: factors.slice(0, 5) };
}
