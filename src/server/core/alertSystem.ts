// src/server/core/alertSystem.ts
import { redis, context } from '@devvit/web/server';
import { REDIS_KEYS, TTL } from './constants';
import { getCached, setCached } from './cache';
import { log } from './logger';
import type { Anomaly, EnrichedQueueItem } from '../../shared/api';

interface AlertState {
  lastSpikeAlert: number;
  lastNewAccountAlert: number;
  lastRepeatAlert: number;
  lastBanEvasionAlert: number;
}

export async function detectAnomalies(
  items: EnrichedQueueItem[]
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const state = await getAlertState();
  const now = Date.now();

  checkReportSpike(items, anomalies, state, now);
  checkNewAccountFlood(items, anomalies, state, now);
  checkRepeatOffenders(items, anomalies, state, now);
  checkBanEvasion(items, anomalies, state, now);

  // Save updated alert state
  await saveAlertState(state);

  if (anomalies.length > 0) {
    log('alertSystem', 'info', 'Anomalies detected', {
      count: anomalies.length,
      types: anomalies.map((a) => a.type).join(', '),
    });
  }

  return anomalies;
}

function checkReportSpike(
  items: EnrichedQueueItem[],
  anomalies: Anomaly[],
  state: AlertState,
  now: number
): void {
  if (now - state.lastSpikeAlert < TTL.ALERT_COOLDOWN_MS) return;

  const totalReports = items.reduce((sum, i) => sum + i.reportCount, 0);
  const uniqueAuthors = new Set(items.map((i) => i.authorName)).size;

  // Spike = more than 15 reports from more than 3 different users
  if (totalReports > 15 && uniqueAuthors >= 3) {
    anomalies.push({
      id: 'spike_' + now,
      type: 'spike',
      severity: totalReports > 30 ? 'critical' : 'high',
      title: 'Report spike detected',
      description:
        totalReports +
        ' reports from ' +
        uniqueAuthors +
        ' different users',
      timestamp: now,
      affectedAuthors: [...new Set(items.map((i) => i.authorName))],
    });
    state.lastSpikeAlert = now;
  }
}

function checkNewAccountFlood(
  items: EnrichedQueueItem[],
  anomalies: Anomaly[],
  state: AlertState,
  now: number
): void {
  if (now - state.lastNewAccountAlert < TTL.ALERT_COOLDOWN_MS) return;

  const newAccounts = items.filter(
    (i) =>
      i.userContext.accountAgeDays >= 0 &&
      i.userContext.accountAgeDays < 7
  );

  if (newAccounts.length >= 3) {
    anomalies.push({
      id: 'newacct_' + now,
      type: 'new_account_flood',
      severity: newAccounts.length >= 5 ? 'critical' : 'high',
      title: 'New account flood',
      description:
        newAccounts.length + ' accounts less than 7 days old in queue',
      timestamp: now,
      affectedAuthors: newAccounts.map((i) => i.authorName),
    });
    state.lastNewAccountAlert = now;
  }
}

function checkRepeatOffenders(
  items: EnrichedQueueItem[],
  anomalies: Anomaly[],
  state: AlertState,
  now: number
): void {
  if (now - state.lastRepeatAlert < TTL.ALERT_COOLDOWN_MS) return;

  const repeatUsers = items.filter(
    (i) => i.userContext.queueAppearances >= 3
  );

  if (repeatUsers.length >= 2) {
    anomalies.push({
      id: 'repeat_' + now,
      type: 'repeat_offender',
      severity: 'medium',
      title: 'Repeat offenders detected',
      description:
        repeatUsers.length + ' users appeared in queue 3+ times',
      timestamp: now,
      affectedAuthors: repeatUsers.map((i) => i.authorName),
    });
    state.lastRepeatAlert = now;
  }
}

function checkBanEvasion(
  items: EnrichedQueueItem[],
  anomalies: Anomaly[],
  state: AlertState,
  now: number
): void {
  if (now - state.lastBanEvasionAlert < TTL.ALERT_COOLDOWN_MS) return;

  // Ban evasion = previously actioned user appearing again with new account indicators
  const previouslyActioned = items.filter(
    (i) => i.userContext.previousActionCount > 0
  );

  const evasionSuspects = previouslyActioned.filter(
    (i) =>
      i.userContext.accountAgeDays >= 0 &&
      i.userContext.accountAgeDays < 30
  );

  if (evasionSuspects.length >= 2) {
    anomalies.push({
      id: 'evasion_' + now,
      type: 'ban_evasion',
      severity: 'critical',
      title: 'Possible ban evasion',
      description:
        evasionSuspects.length +
        ' previously actioned users with new accounts',
      timestamp: now,
      affectedAuthors: evasionSuspects.map((i) => i.authorName),
    });
    state.lastBanEvasionAlert = now;
  }
}

async function getAlertState(): Promise<AlertState> {
  const key = REDIS_KEYS.ALERT_STATE + context.subredditId;
  const cached = await getCached<AlertState | null>(key, null);

  if (cached) return cached;

  return {
    lastSpikeAlert: 0,
    lastNewAccountAlert: 0,
    lastRepeatAlert: 0,
    lastBanEvasionAlert: 0,
  };
}

async function saveAlertState(state: AlertState): Promise<void> {
  const key = REDIS_KEYS.ALERT_STATE + context.subredditId;
  await setCached(key, state, 24 * 60 * 60 * 1000);
}
