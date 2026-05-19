// FILE 8: src/server/core/constants.ts

export const REDIS_KEYS = {
  QUEUE_SNAPSHOT: 'mqcc:queue:',
  USER_CONTEXT: 'mqcc:u2:',
  MOD_ACTIONS: 'mqcc:actions:',
  QUEUE_APPEARANCES: 'mqcc:appear:',
  ANOMALIES: 'mqcc:anomalies:',
  SETTINGS: 'mqcc:settings:',
  WORKLOAD: 'mqcc:workload:',
  RATE_LIMIT: 'mqcc:ratelimit:',
  ALERT_STATE: 'mqcc:alertstate:',
  STORED_MODS: 'mqcc:storedmods:',
  SETUP_COMPLETE: 'mqcc:setup:',
} as const;

export const TTL = {
  QUEUE_SNAPSHOT_MS: 60 * 1000,
  USER_CONTEXT_MS: 60 * 60 * 1000,
  MOD_ACTIONS_MS: 30 * 24 * 60 * 60 * 1000,
  ANOMALIES_MS: 15 * 60 * 1000,
  SETTINGS_MS: 24 * 60 * 60 * 1000,
  APPEARANCES_MS: 7 * 24 * 60 * 60 * 1000,
  ALERT_COOLDOWN_MS: 30 * 60 * 1000,
  STORED_MODS_MS: 365 * 24 * 60 * 60 * 1000,
} as const;

export const MAX_QUEUE_ITEMS = 100;

export const DEFAULT_SETTINGS = {
  priorityWeights: {
    reportCount: 0.3,
    accountAge: 0.25,
    karma: 0.2,
    queueHistory: 0.15,
    modHistory: 0.1,
  },
  autoRefresh: false,
  refreshIntervalMs: 30000,
  groupSpamRings: true,
  enableAlerts: true,
  compactMode: false,
} as const;
