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

  if (anomalies.length > 0) {
    await saveAlertState(state);
    await persistAnomalies(anomalies);

    log('alertSystem', 'info', 'Anomalies detected', {
      count: anomalies.length,
      types: anomalies.map((a) => a.type).join(', '),
    });
  }

  const cached = await loadPersistedAnomalies();
  if (cached.length > 0) {
    const existingIds = new Set(anomalies.map((a) => a.id));
    for (const a of cached) {
      if (!existingIds.has(a.id)) {
        anomalies.push(a);
      }
    }
  }

  return anomalies;
}

async function persistAnomalies(anomalies: Anomaly[]): Promise<void> {
  try {
    const key = REDIS_KEYS.ANOMALIES + context.subredditId;
    const existingRaw = await redis.get(key);
    let existing: Anomaly[] = existingRaw ? JSON.parse(existingRaw as string) : [];

    const now = Date.now();
    existing = existing.filter((a) => now - a.timestamp < TTL.ANOMALIES_MS);

    const existingIds = new Set(existing.map((a) => a.id));
    for (const a of anomalies) {
      if (!existingIds.has(a.id)) {
        existing.push(a);
      }
    }

    await redis.set(key, JSON.stringify(existing), {
      expiration: new Date(Date.now() + TTL.ANOMALIES_MS),
    });
  } catch (e) {
    log('alertSystem', 'warn', 'Failed to persist anomalies', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function loadPersistedAnomalies(): Promise<Anomaly[]> {
  try {
    const key = REDIS_KEYS.ANOMALIES + context.subredditId;
    const raw = await redis.get(key);
    if (!raw) return [];

    const anomalies: Anomaly[] = JSON.parse(raw as string);
    const now = Date.now();
    return anomalies.filter((a) => now - a.timestamp < TTL.ANOMALIES_MS);
  } catch {
    return [];
  }
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

  if (totalReports > 15 && uniqueAuthors >= 3) {
    anomalies.push({
      id: 'spike_' + Math.floor(now / TTL.ALERT_COOLDOWN_MS),
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
      id: 'newacct_' + Math.floor(now / TTL.ALERT_COOLDOWN_MS),
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
      id: 'repeat_' + Math.floor(now / TTL.ALERT_COOLDOWN_MS),
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
      id: 'evasion_' + Math.floor(now / TTL.ALERT_COOLDOWN_MS),
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
