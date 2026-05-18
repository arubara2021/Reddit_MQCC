export interface RawQueueItem {
  id: string;
  fullname: string;
  type: 'post' | 'comment';
  title: string;
  body: string;
  authorName: string;
  subredditName: string;
  createdAt: number;
  url: string;
  permalink: string;
  reportReasons: string[];
  reportCount: number;
  isRemoved: boolean;
  isApproved: boolean;
  isLocked: boolean;
}

export interface UserContext {
  username: string;
  accountAgeDays: number;
  totalKarma: number;
  postKarma: number;
  commentKarma: number;
  previousActionCount: number;
  lastActionType: string | null;
  lastActionTimestamp: number;
  queueAppearances: number;
  isSuspended: boolean;
  isShadowbanned: boolean;
  cachedAt: number;
}

export interface PriorityScore {
  score: number;
  level: 'critical' | 'high' | 'medium' | 'low';
  factors: string[];
}

export interface EnrichedQueueItem {
  id: string;
  fullname: string;
  type: 'post' | 'comment';
  title: string;
  body: string;
  authorName: string;
  subredditName: string;
  createdAt: number;
  url: string;
  permalink: string;
  reportReasons: string[];
  reportCount: number;
  isRemoved: boolean;
  isApproved: boolean;
  isLocked: boolean;
  userContext: UserContext;
  priority: PriorityScore;
}

export interface GroupedQueueItem {
  id: string;
  groupType: 'link_cluster' | 'time_burst' | 'username_pattern';
  label: string;
  description: string;
  items: EnrichedQueueItem[];
  authors: string[];
  domains: string[];
  topPriority: PriorityScore;
  createdAt: number;
}

export interface Anomaly {
  id: string;
  type: 'spike' | 'new_account_flood' | 'repeat_offender' | 'ban_evasion';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  timestamp: number;
  affectedAuthors: string[];
}

export interface ModPermissions {
  canRemove: boolean;
  canBan: boolean;
  canApprove: boolean;
  canLock: boolean;
  canManageFlair: boolean;
  canAccessModLog: boolean;
  isMod: boolean;
}

export interface ModActionRecord {
  action: 'approve' | 'remove' | 'ban' | 'lock' | 'removeAndBan';
  targetAuthor: string;
  targetId: string;
  reason: string | null;
  modName: string;
  timestamp: number;
}

export interface PatternResult {
  linkClusters: Array<{
    domain: string;
    count: number;
    uniqueAuthors: string[];
  }>;
  timeBursts: Array<{
    count: number;
    windowHours: number;
    newAccountCount: number;
  }>;
  usernamePatterns: Array<{
    pattern: string;
    accounts: string[];
  }>;
}

export interface QueueSnapshot {
  items: RawQueueItem[];
  timestamp: number;
  subredditId: string;
}

export interface InitResponse {
  subredditName: string;
  subredditId: string;
  isMod: boolean;
  verified: boolean;
}

export interface ModNote {
  id: string;
  username: string;
  note: string;
  modName: string;
  createdAt: number;
}

export interface AppSettings {
  priorityWeights: {
    reportCount: number;
    accountAge: number;
    karma: number;
    queueHistory: number;
    modHistory: number;
  };
  autoRefresh: boolean;
  refreshIntervalMs: number;
  groupSpamRings: boolean;
  enableAlerts: boolean;
  compactMode: boolean;
}
