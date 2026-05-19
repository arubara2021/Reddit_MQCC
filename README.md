# MQCC — Mod Queue Command Center

![Devvit](https://img.shields.io/badge/Platform-Devvit-FF4500?style=flat-square&logo=reddit)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-4.12-FF6B35?style=flat-square)
![Redis](https://img.shields.io/badge/Redis-Platform--managed-DC382D?style=flat-square&logo=redis&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

A real-time moderation dashboard for Reddit built on the Devvit platform. MQCC replaces the native flat mod queue with a priority-scored, context-enriched interface that detects coordinated spam patterns, surfaces anomaly alerts, and exposes bulk action workflows — all within a single installable Devvit app.

---

## Table of Contents

- [The Problem](#the-problem)
- [Architecture](#architecture)
- [Priority Scoring Algorithm](#priority-scoring-algorithm)
- [Pattern Detection](#pattern-detection)
- [Anomaly Detection](#anomaly-detection)
- [Feature Breakdown](#feature-breakdown)
- [Server Modules](#server-modules)
- [Client Components](#client-components)
- [Data Flow](#data-flow)
- [Redis Schema](#redis-schema)
- [API Endpoints](#api-endpoints)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Built With](#built-with)

---

## The Problem

Reddit's native mod queue presents reported items as an unsorted flat list with no priority signal, no author context, and no pattern awareness. Moderators processing hundreds of items per week face five structural deficiencies:

**No severity ranking.** A post flagged by 15 accounts sits at the same visual weight as a single-report item. There is no mechanism to surface the most urgent items first.

**No inline user context.** Every reported item is evaluated in isolation. Account age, karma, prior mod actions, and queue appearance frequency are not visible without navigating to the user's profile page.

**No automated pattern recognition.** Coordinated spam rings posting links to the same domain, bot farms using sequential naming conventions, and report spikes from time-burst attacks all require manual identification by the moderator.

**No bulk operation support.** Cleaning a coordinated spam ring of 20 posts requires 20 individual approve/remove/ban cycles. There is no select-and-act workflow.

**No community transparency.** Non-moderator members have no visibility into mod team activity, which erodes trust in larger communities.

MQCC resolves all five deficiencies in a single Devvit installation.

---

## Architecture

MQCC follows a client-server split mandated by the Devvit platform: server-side logic executes in a secure serverless environment with access to Redis and the Reddit API, while the client renders inside an iframe on reddit.com.

```
┌──────────────────────────────────────────────────────────┐
│  Reddit.com (iframe)                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  React 19 Client                                   │  │
│  │  Dashboard / PublicDashboard / Splash              │  │
│  │  Custom hooks: useQueue, useWorkload, useSettings   │  │
│  └──────────────────┬─────────────────────────────────┘  │
│                     │ HTTP (fetch)                        │
│  ┌──────────────────▼─────────────────────────────────┐  │
│  │  Hono Server (Devvit Serverless)                   │  │
│  │  /api/*  /internal/*                               │  │
│  │  ┌───────────────┐  ┌──────────────────────────┐   │  │
│  │  │ Route Handlers │  │ Core Modules             │   │  │
│  │  │ api.ts         │  │ queueFetcher.ts          │   │  │
│  │  │ community.ts   │  │ contextEnricher.ts       │   │  │
│  │  │ forms.ts       │  │ priorityScorer.ts        │   │  │
│  │  │ menu.ts        │  │ patternDetector.ts       │   │  │
│  │  │ triggers.ts    │  │ alertSystem.ts           │   │  │
│  │  └───────────────┘  │ modActions.ts            │   │  │
│  │                      │ activityTracker.ts        │   │  │
│  │                      │ permissions.ts            │   │  │
│  │                      │ rateLimiter.ts            │   │  │
│  │                      │ settings.ts               │   │  │
│  │                      │ cache.ts / logger.ts      │   │  │
│  │                      └──────────────────────────┘   │  │
│  └──────────┬───────────────────┬─────────────────────┘  │
│             │                   │                         │
│  ┌──────────▼──────┐  ┌────────▼─────────────────────┐  │
│  │  Reddit API     │  │  Redis (Devvit-managed)       │  │
│  │  getModQueue    │  │  Queue snapshots              │  │
│  │  getUserByName  │  │  User context cache           │  │
│  │  approve/remove │  │  Mod action history           │  │
│  │  banUser/lock   │  │  Queue appearance counts      │  │
│  │  submitPost     │  │  Settings / Alert state       │  │
│  └─────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Stack:**
- Frontend: React 19, TypeScript, Vite, custom CSS design system (no UI framework)
- Backend: Node.js 22 serverless (Devvit), Hono HTTP framework
- Storage: Redis (provided automatically by Devvit, zero infrastructure)
- Communication: Direct HTTP via `fetch` from client to `/api/*` endpoints

---

## Priority Scoring Algorithm

Every reported item passes through `priorityScorer.ts` which computes a score from 0 to 100. The algorithm evaluates seven weighted factors:

| Factor | Range | Logic |
|---|---|---|
| Report count | 0 — 25 | `min(reportCount * 8, 25)`. A single report scores 8, three reports score 24, capped at 25. |
| Account age | 0 — 25 | `< 1 day` = 25, `< 7 days` = 20, `< 30 days` = 10, otherwise 0. Only evaluated when `accountAgeDays >= 0`. |
| Karma | 0 — 20 | `totalKarma < 1` = 20, `< 10` = 15, `< 50` = 5, otherwise 0. Only evaluated when `totalKarma >= 0`. |
| Queue history | 0 — 15 | `queueAppearances >= 5` = 15, `>= 3` = 10, `>= 2` = 5. Appearance counts stored in Redis with 7-day TTL. |
| Prior mod actions | 0 — 10 | `previousActionCount >= 3` = 10, `>= 1` = 5. Reads from the `mqcc:actions:{subredditId}` list. |
| Shadowbanned | +15 | Flat bonus when `userContext.isShadowbanned === true`. |
| Suspended | +15 | Flat bonus when `userContext.isSuspended === true`. |

Additionally, the algorithm scans report reasons for spam keywords (`spam`, `scam`, `phishing`, `bot`, `self-promotion`). Each keyword match adds 10 points. The final score is capped at 100.

**Severity thresholds:**

| Score Range | Level | Display |
|---|---|---|
| 80 — 100 | `critical` | Red indicator |
| 55 — 79 | `high` | Orange indicator |
| 30 — 54 | `medium` | Yellow indicator |
| 0 — 29 | `low` | Gray indicator |

The priority weights are configurable per-subreddit through the Settings API. The `settings.ts` module validates that weights sum to approximately 1.0 and normalizes them if they deviate.

---

## Pattern Detection

The `patternDetector.ts` module analyzes the enriched queue to identify three classes of coordinated behavior.

### Link Cluster Detection

Iterates all queue items, extracts domains from `body`, `url`, and `title` fields using a regex-based parser (`extractDomains` in `queueFetcher.ts`). Builds a `Map<domain, author[]>`. Any domain shared by 2 or more distinct authors is flagged as a link cluster.

```
Input:  5 items linking to "spam-site.xyz" from 3 unique authors
Output: { domain: "spam-site.xyz", count: 3, uniqueAuthors: [...] }
```

### Time Burst Detection

Sorts items by `createdAt`, then slides a 1-hour window across the timeline. If 3 or more items fall within a single window AND at least 2 of those items are from accounts less than 7 days old, the window is flagged as a time burst.

```
Input:  4 items created within 45 minutes, 3 from accounts < 7 days old
Output: { count: 4, windowHours: 1, newAccountCount: 3 }
```

### Username Pattern Detection

Tests all unique author names against five regex patterns:

| Pattern | Regex | Detects |
|---|---|---|
| name+numbers | `/([a-z]+)\d{2,4}$/i` | `user_01`, `bot4832` |
| name_name | `/^([a-z]+)_([a-z]+)/i` | `john_doe`, `spam_account` |
| auto_ prefix | `/^auto_/i` | `auto_post`, `auto_comment` |
| bot_ prefix | `/^bot_/i` | `bot_01`, `bot_spammer` |
| repeated characters | `/(\w)\1{3,}/` | `aaaa_spam`, `xxxx_bot` |

A pattern is reported when 3 or more accounts match the same regex.

---

## Anomaly Detection

The `alertSystem.ts` module runs continuously against the enriched queue and generates `Anomaly` objects when thresholds are crossed. Each anomaly type has a 30-minute cooldown (configurable via `TTL.ALERT_COOLDOWN_MS`) to prevent alert fatigue.

| Anomaly Type | Threshold | Severity |
|---|---|---|
| Report spike | > 15 total reports from >= 3 unique authors | `high` (> 30 reports = `critical`) |
| New account flood | >= 3 queue items from accounts < 7 days old | `high` (>= 5 = `critical`) |
| Repeat offenders | >= 2 users with >= 3 queue appearances | `medium` |
| Ban evasion | >= 2 previously actioned users with accounts < 30 days old | `critical` |

Anomaly state is persisted in Redis (`mqcc:alertstate:{subredditId}`) with a 24-hour TTL so cooldowns survive page refreshes.

---

## Feature Breakdown

### Mod Dashboard (Authenticated View)

**Priority Queue.** Fetches the mod queue via `reddit.getModQueue`, enriches each item with user context from the Reddit API, scores it through the priority algorithm, and renders items sorted by descending score. Each item displays a color-coded priority dot, content type (POST/COMMENT), author name, report count, and inline user context (account age, karma, prior actions, queue appearances).

**Filter Bar.** Filters the rendered queue by: All, Posts, Comments, Critical severity, High severity. Filtering operates on the already-fetched enriched dataset — no additional API calls.

**Detail Modal.** Full-item view showing: content body, author profile (account age, total/post/comment karma, queue appearances, prior mod actions, last action type and timestamp), report reasons as pill badges, priority factors as warning pills, and a permalink button that opens the item on reddit.com.

**Bulk Action Bar.** Sticky bottom bar that appears when one or more items are selected. Supports: Approve selected, Remove selected, Ban selected users, Remove and Ban in one step. Ban duration is configurable: Permanent, 1, 3, 7, 14, or 30 days. The bar shows the selected count and a "Clear" button.

**Pattern Alerts.** Rendered at the top of the queue tab when `patternDetector.ts` identifies link clusters, time bursts, or username patterns. Each alert shows the pattern type, affected count, and for link clusters, the shared domain.

**Anomaly Banner.** Displays the highest-severity anomaly from `alertSystem.ts` at the top of the queue tab. Shows severity badge, title, description, and "+N more alerts" if multiple anomalies exist. Dismissible per-session.

**Workload Tab.** Fetches data from `activityTracker.ts` and renders: three-stat grid (total actions, active mods, flagged users), actions-by-type horizontal bar chart (approve/remove/ban/lock with percentage breakdowns), per-mod activity breakdown with proportional bars, top flagged users table ranked by action count with severity coloring (>= 5 actions = red, >= 3 = orange), and a recent action feed (last 15 actions with timestamp-relative display).

**Settings Tab.** Persistent configuration stored in Redis via `settings.ts`: auto-refresh toggle (on/off), refresh interval selector (10s, 30s, 1m, 2m, 5m), compact mode toggle, group spam rings toggle, anomaly alerts toggle.

### Public Dashboard (Unauthenticated / Non-Mod View)

When the `permissions.ts` module determines the current user is not a moderator, the client renders a completely separate view: `PublicDashboard.tsx`.

**Hero Card.** Displays subreddit name, health status badge (Excellent >= 85%, Good >= 65%, Fair >= 45%, Needs Attention < 45%), active status indicator, and three stats: active contributors, post count, health percentage.

**Leaderboard.** Three tabs: Top Contributors (ranked by approval count), Most Comments (ranked by total comment count), Karma Leaders (ranked by highest-scoring post). Data sourced from `community.ts` which has three fallback layers: live Reddit posts via `getHotPosts`/`getNewPosts`/`getTopPosts`, stored mod action history from Redis, or cached queue snapshot. Time range selector: This Week, This Month, All Time.

**Viewer Rank.** If the current user appears in the active leaderboard, a dedicated card shows their rank number and score. The viewer's row in the leaderboard is visually highlighted.

**Recent Activity.** Anonymized feed showing the last 5 community actions with action type badge, author name, and relative timestamp.

**Visual Design.** The public dashboard uses a distinct purple-tinted palette (`--pub-accent: #a855f7`) with gradient mesh backgrounds, animated number counters, and a "Powered by MQCC" footer — completely separate from the zinc-tinted mod dashboard.

### Splash Screen (Inline Feed View)

Rendered in the Reddit feed via `splash.html`. Displays a compact card with gold accent (`#f0b429`) showing the shield icon, subreddit name, and "Tap to explore leaderboard". Uses DM Sans and Space Mono fonts. Fetches `/api/init` to resolve the subreddit name. Acts as the entry point to the full dashboard.

---

## Server Modules

| Module | File | Responsibility |
|---|---|---|
| Queue Fetcher | `queueFetcher.ts` | Fetches mod queue from Reddit via `getModQueue`, parses raw items into `RawQueueItem[]`, extracts report data from `reportReasons`/`modReports`/`numReports` fields, caches snapshot in Redis with 60s TTL, falls back to cache on API failure |
| Context Enricher | `contextEnricher.ts` | Fetches user profiles via `getUserByUsername`, computes account age in days, extracts post/comment/total karma, detects suspended/shadowbanned status, merges with mod action history and queue appearance counts from Redis, caches enriched `UserContext` with 1-hour TTL, processes authors in batches of 3 to avoid rate limiting |
| Priority Scorer | `priorityScorer.ts` | Pure function: `(RawQueueItem, UserContext) => PriorityScore`. Seven-factor weighted scoring algorithm (see [Priority Scoring Algorithm](#priority-scoring-algorithm)). Score 0-100 with four severity levels. |
| Pattern Detector | `patternDetector.ts` | Pure function: `(EnrichedQueueItem[]) => PatternResult`. Three detection methods: link clusters via domain extraction, time bursts via 1-hour sliding window, username patterns via regex matching (see [Pattern Detection](#pattern-detection)). |
| Alert System | `alertSystem.ts` | Stateful anomaly detection with Redis-backed cooldown. Four checks: report spike, new account flood, repeat offenders, ban evasion (see [Anomaly Detection](#anomaly-detection)). Alert state persisted with 24h TTL. |
| Mod Actions | `modActions.ts` | Executes Reddit API calls: `approve`, `remove`, `lock`, `banUser`. Each action records a `ModActionRecord` in Redis (max 500 records, 30-day TTL). Ban duration normalized to nearest valid value from `[0, 1, 3, 7, 14, 30]`. |
| Activity Tracker | `activityTracker.ts` | Aggregates mod action history into workload statistics: actions by mod, by type, by hour, by day. Computes coverage gaps (hours with zero activity). Identifies top flagged users. Generates leaderboards (contributors/comments/karma) filtered by time range. Results cached for 5-15 minutes. |
| Permissions | `permissions.ts` | Resolves current user via `reddit.getCurrentUsername`, checks against stored moderator list in Redis. First user bootstrapped as moderator on initial setup. Provides `requireMod()` guard for protected endpoints. |
| Rate Limiter | `rateLimiter.ts` | Sliding-window rate limiter backed by Redis. Default: 30 req/min. Action endpoints: 10 req/min. Bulk operations: 5 req/5min. Fails open on Redis errors. |
| Cache | `cache.ts` | Generic Redis cache wrapper: `getCached<T>`, `setCached`, `deleteCached`, `cacheExists`. All operations wrapped in try-catch with structured logging on failure. |
| Settings | `settings.ts` | Reads/writes per-subreddit settings in Redis. Validates priority weights sum to ~1.0 (normalizes if not). Clamps refresh interval to 10s-300s range. |
| Logger | `logger.ts` | Structured JSON logger writing to `console.log`/`console.warn`/`console.error`. Every entry includes `timestamp`, `module`, `level`, `message`, and optional data fields. |
| Post | `post.ts` | Creates and searches for dashboard posts via `reddit.submitCustomPost` and `reddit.getHotPosts`. |

---

## Client Components

| Component | Responsibility |
|---|---|
| `Dashboard.tsx` | Root orchestrator. Resolves mod status via `/api/init`, routes to `PublicDashboard` or mod view. Manages tab state (queue/workload/alerts/settings), filter state, selection state, bulk action flow, confirmation dialogs, toast notifications. Fetches anomalies and patterns on mount. |
| `PriorityQueue.tsx` | Renders grouped items (spam rings, time bursts, coordinated accounts) above individual items. Groups display pattern label, severity badge, affected authors, shared domains, and expandable item list with group-level "Remove All" / "Ban All" actions. Individual items sorted by descending priority score. |
| `QueueItem.tsx` | Single queue row: checkbox for selection, priority color dot, content type label, author name, report count, priority score, content preview (clickable for detail modal), report reason pills, inline `ContextCard`, and action buttons (Approve/Remove/Ban). Supports compact mode. |
| `DetailModal.tsx` | Full overlay showing: priority badge with score, content body, author profile with `ContextCard`, user details grid (account age, total/post/comment karma, queue appearances, prior actions, last action), report reasons, priority factors, permalink button, ban duration selector, and action buttons. |
| `BulkActionBar.tsx` | Sticky bottom bar: selected count display, "Clear" button, ban duration dropdown (Permanent/1/3/7/14/30 days), and four action buttons (Approve/Remove/Ban/R+B). Memoized with `React.memo`. |
| `WorkloadTab.tsx` | Fetches via `useWorkload` hook. Renders: stat grid, actions-by-type bar chart, per-mod activity bars, top flagged users list, recent actions feed (last 15). Each section has loading/error/empty states. |
| `PublicDashboard.tsx` | Community-facing view: hero card with health score, three leaderboard tabs with animated number counters, time range dropdown, ranked user cards with proportional bars, viewer rank card, recent activity feed, "Powered by MQCC" footer. Fetches from `/api/community`. |
| `ContextCard.tsx` | Inline user context: account age in days, total karma, conditional badges (Suspended, Shadowbanned, New account, Low karma, N prior actions, Repeated Nx). Memoized. |
| `PatternAlert.tsx` | Renders link clusters (blue), time bursts (yellow), and username patterns (accent) as colored alert cards with count badges. |
| `AlertBanner.tsx` | Renders the highest-severity anomaly with severity badge, title, description, "+N more" count, and dismiss button. Color-coded by severity. |
| `ConfirmDialog.tsx` | Confirmation modal for destructive actions. Shows warning icon for danger actions, title, message, Cancel/Confirm buttons with loading state. |
| `EmptyState.tsx` | Centered empty state with checkmark icon, title, and description. Memoized. |
| `LoadingState.tsx` | Centered spinner with configurable message. Memoized. |
| `ErrorBoundary.tsx` | React error boundary with error message display and reload button. Catches unhandled rendering errors and prevents full-page crashes. |

### Custom Hooks

| Hook | Endpoint | Behavior |
|---|---|---|
| `useQueue` | `GET /api/queue` | Fetches enriched queue, stores items + groups + lastUpdated. Supports auto-refresh with configurable interval (clamped 10s-300s). Deduplicates concurrent fetches via `fetchingRef`. |
| `useWorkload` | `GET /api/workload` | Fetches workload statistics (actions by mod/type/hour/day, recent actions, coverage gaps, top flagged users). |
| `useSettings` | `GET/POST /api/settings` | Reads and writes per-subreddit settings. `resetSettings` calls `POST /api/settings/reset`. Falls back to `DEFAULT_SETTINGS` on error. |
| `usePatterns` | `GET /api/patterns` | Fetches pattern detection results (link clusters, time bursts, username patterns). |

---

## Data Flow

### Queue Request Lifecycle

```
1. Client calls GET /api/queue
2. queueFetcher.ts calls reddit.getModQueue({ subreddit, limit: 100 })
3. Raw items parsed into RawQueueItem[] (report data extraction, fullname resolution)
4. Snapshot cached in Redis (key: mqcc:queue:{subredditId}, TTL: 60s)
5. contextEnricher.ts processes authors in batches of 3:
   a. Check Redis cache (key: mqcc:u2:{username}, TTL: 1h)
   b. On cache miss: call reddit.getUserByUsername, compute account age/karma/status
   c. Merge with mod action history from mqcc:actions:{subredditId}
   d. Merge with queue appearance count from mqcc:appear:{username}
   e. Cache enriched UserContext in Redis
6. priorityScorer.ts computes PriorityScore for each item (pure function, no I/O)
7. incrementQueueAppearance called for each author (Redis INCR equivalent)
8. Items sorted by descending priority score
9. Response: { items: EnrichedQueueItem[], groups: [], lastUpdated: timestamp }
```

### Action Execution Lifecycle

```
1. Client calls POST /api/action/{action}
2. Rate limiter checks (10 req/min per action type)
3. Mod action executed via Reddit API (approve/remove/lock/banUser)
4. ModActionRecord stored in Redis (key: mqcc:actions:{subredditId}, max 500, TTL: 30d)
5. Queue snapshot cache cleared (key: mqcc:queue:{subredditId})
6. Response: { success: boolean, message: string }
7. Client triggers queue re-fetch after 500ms delay
```

### Permission Resolution

```
1. Client calls GET /api/init
2. permissions.ts calls reddit.getCurrentUsername()
3. Checks stored mod list in Redis (key: mqcc:storedmods:{subredditId})
4. If list exists: check if current user is in list
5. If list empty + setup not complete: bootstrap current user as first mod
6. If list empty + setup complete: user is not a mod
7. Response: { subredditName, subredditId, isMod, verified }
```

---

## Redis Schema

| Key Pattern | Contents | TTL |
|---|---|---|
| `mqcc:queue:{subredditId}` | Cached `QueueSnapshot` (items array + timestamp) | 60s |
| `mqcc:u2:{username}` | Enriched `UserContext` object | 1 hour |
| `mqcc:actions:{subredditId}` | Array of `ModActionRecord` (max 500) | 30 days |
| `mqcc:appear:{username}` | Queue appearance count (integer as string) | 7 days |
| `mqcc:settings:{subredditId}` | `AppSettings` JSON object | 24 hours |
| `mqcc:workload:{subredditId}` | Cached `WorkloadData` aggregation | 5 minutes |
| `mqcc:workload:{subredditId}:lb:{range}` | Cached `LeaderboardData` | 5-15 minutes |
| `mqcc:alertstate:{subredditId}` | `AlertState` with cooldown timestamps | 24 hours |
| `mqcc:storedmods:{subredditId}` | Array of moderator usernames | 365 days |
| `mqcc:setup:{subredditId}` | `"true"` string flag | 365 days |
| `mqcc:ratelimit:{identifier}` | Array of request timestamps | 2x window |

---

## API Endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/init` | Resolve user identity and mod status | None |
| GET | `/api/queue` | Fetch enriched, priority-scored mod queue | Mod |
| GET | `/api/anomalies` | Run anomaly detection on current queue | Mod |
| GET | `/api/patterns` | Run pattern detection on current queue | Mod |
| GET | `/api/workload` | Fetch mod activity statistics | Mod |
| GET | `/api/leaderboard?range=` | Fetch community leaderboard (week/month/all) | None |
| GET | `/api/settings` | Read current subreddit settings | Mod |
| POST | `/api/settings` | Update subreddit settings (partial merge) | Mod |
| POST | `/api/settings/reset` | Reset settings to defaults | Mod |
| GET | `/api/ban-durations` | List valid ban duration options | None |
| POST | `/api/action/approve` | Approve a single item | Mod |
| POST | `/api/action/remove` | Remove a single item | Mod |
| POST | `/api/action/lock` | Lock a single item | Mod |
| POST | `/api/action/ban` | Ban a user | Mod |
| POST | `/api/action/removeAndBan` | Remove item and ban author | Mod |
| POST | `/api/action/bulk` | Execute bulk action on multiple items | Mod |
| GET | `/api/community?subreddit=` | Fetch public community data | None |

---

## Installation

### For Developers

**Prerequisites:** Node.js 22+, Devvit CLI (`npm install -g @devvit/cli`), a Reddit account with moderator permissions on a test subreddit.

```bash
git clone https://github.com/arubara2021/Reddit_MQCC
cd mqcc
npm install
npm run login
npm run dev
```

This starts the playtest environment. Navigate to the playtest URL on your subreddit to see the app running.

**Deploy to production:**

```bash
npm run deploy    # type-check + lint + upload to Devvit
npm run launch    # deploy + publish to App Directory
```

**Commands:**

| Command | Action |
|---|---|
| `npm run dev` | Start playtest with hot reload |
| `npm run build` | Build client and server bundles |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint across all source files |
| `npm run test` | Run Vitest test suite |
| `npm run deploy` | Type-check, lint, and upload to Devvit |
| `npm run launch` | Deploy and publish to App Directory |

### For Moderators

1. Navigate to the Reddit App Directory for your subreddit
2. Search for "MQCC" or "Mod Queue Command Center"
3. Click Install
4. Open the app from your subreddit sidebar or app launcher
5. The queue tab loads automatically with reported items sorted by priority

**Requirements:** The installing user must have full moderator permissions. The app stores data in Devvit-managed Redis — no external database or API keys required.

---

## Project Structure

```
src/
  client/
    components/
      AlertBanner.tsx          Anomaly alert display with severity styling
      BulkActionBar.tsx        Sticky bottom bar for bulk operations
      ConfirmDialog.tsx        Confirmation modal for destructive actions
      ContextCard.tsx          Inline user context (age, karma, badges)
      Dashboard.tsx            Root component: tab routing, state orchestration
      DetailModal.tsx          Full item detail with user profile and actions
      EmptyState.tsx           Empty state placeholder
      ErrorBoundary.tsx        React error boundary with reload fallback
      LoadingState.tsx         Loading spinner
      PatternAlert.tsx         Pattern detection alert cards
      PriorityQueue.tsx        Grouped + individual queue rendering
      PublicDashboard.tsx      Community-facing leaderboard view
      QueueItem.tsx            Single queue row with actions
      WorkloadTab.tsx          Mod activity analytics
    hooks/
      usePatterns.ts           Pattern detection data fetching
      useQueue.ts              Queue data fetching with auto-refresh
      useSettings.ts           Settings read/write with defaults
      useWorkload.ts           Workload statistics fetching
    dashboard.html             Expanded view HTML shell
    dashboard.tsx              Expanded view React entry point
    splash.html                Inline view HTML shell
    splash.tsx                 Inline view React entry point
    index.css                  Design system: tokens, components, responsive
    module.d.ts                TypeScript module declarations
    utils/
      time.ts                  Relative timestamp formatting
  server/
    core/
      activityTracker.ts       Mod action aggregation and leaderboard generation
      alertSystem.ts           Anomaly detection with cooldown state
      cache.ts                 Redis cache wrapper (get/set/delete/exists)
      constants.ts             Redis key patterns, TTL values, default settings
      contextEnricher.ts       User profile fetching, context building, batching
      logger.ts                Structured JSON logger
      modActions.ts            Reddit API action execution (approve/remove/ban/lock)
      patternDetector.ts       Link cluster, time burst, username pattern detection
      permissions.ts           User resolution, mod list management, bootstrap
      post.ts                  Dashboard post creation and search
      priorityScorer.ts        Seven-factor priority scoring algorithm
      queueFetcher.ts          Mod queue fetching, parsing, domain extraction
      rateLimiter.ts           Sliding-window rate limiter
      settings.ts              Per-subreddit settings read/write/validate
    routes/
      api.ts                   REST API handler (17 endpoints)
      community.ts             Public community data with 3-layer fallback
      forms.ts                 Form submission handlers (ban, bulk-ban, remove-and-ban)
      menu.ts                  Subreddit menu action handler
      triggers.ts              App install trigger (bootstrap first mod)
    index.ts                   Hono server entry point
  shared/
    api.ts                     Shared TypeScript type definitions
tools/
  tsconfig.base.json           Base TypeScript configuration
  tsconfig.client.json         Client TypeScript configuration
  tsconfig.server.json         Server TypeScript configuration
  tsconfig.shared.json         Shared TypeScript configuration
  tsconfig.vite.json           Vite config TypeScript configuration
.github/
  dependabot.yml               Automated dependency update schedule
devvit.json                    Devvit app configuration
vite.config.ts                 Vite build configuration
eslint.config.js               ESLint configuration
tsconfig.json                  TypeScript project references
package.json                   Dependencies and scripts
vitest.config.ts               Vitest test configuration
```

---

## Design Decisions

**No UI framework.** Every component is styled with CSS custom properties defined in `index.css`. This eliminates framework dependency weight, avoids lock-in to any component library's design language, and provides full control over responsive behavior. The design system uses 40+ CSS custom properties for colors, spacing, radius, shadows, and typography.

**Redis for all persistence.** Mod action history, user context cache, queue snapshots, settings, alert state, rate limiter state, and moderator lists all reside in Redis. The Devvit platform provisions Redis automatically with no configuration required. There is no external database, no migrations, no connection management.

**Server-side enrichment.** User context is fetched and cached on the server in `contextEnricher.ts`, not on the client. The client receives fully enriched data in a single `/api/queue` call. This avoids dozens of individual profile requests from the browser, reduces client complexity, and keeps Reddit API interactions in the serverless environment where they are authenticated.

**Graceful degradation.** Every external call — Reddit API, Redis reads/writes, user profile fetches — is wrapped in try-catch with fallback behavior. Queue fetch failure returns cached snapshot. User profile unavailability returns default context with `-1` sentinel values for unknown fields. Anomaly detection failure returns an empty array. The dashboard remains functional even when individual subsystems fail.

**Batch processing with rate limit awareness.** User context enrichment processes authors in batches of 3 (`Promise.allSettled`) to avoid hitting Reddit API rate limits. The rate limiter module enforces per-action (10/min) and per-bulk-operation (5/5min) limits independently.

**Separate visual identities.** The mod dashboard uses a zinc-tinted dark palette (`--bg-base: #0a0c10`, accent blue `#4f8ff7`) optimized for dense information display. The public dashboard uses a purple-tinted palette (`--pub-accent: #a855f7`) with gradient backgrounds and animated counters, designed for community engagement rather than data density. The splash screen uses a gold accent (`#f0b429`) on dark blue, optimized for feed visibility.

---

## Testing

The project includes unit tests for core algorithms using Vitest:

```bash
npm run test
```

| Test Suite | Coverage |
|---|---|
| `patternDetector.test.ts` | 15 test cases covering link cluster detection (domain extraction, www stripping, multi-cluster, dedup), time burst detection (3+ items in 1h window, new account threshold, edge cases), username pattern detection (all 5 regex patterns, case insensitivity, threshold enforcement), and combined pattern scenarios |
| `priorityScorer.test.ts` | 28 test cases covering all 7 scoring factors, spam keyword detection, score cap at 100, severity level thresholds, factors array limits, unknown data handling (-1 sentinels), and post/comment parity |

---

## Built With

| Technology | Version | Role |
|---|---|---|
| [Devvit](https://developers.reddit.com/) | 0.12.23 | Reddit developer platform (serverless, Redis, Reddit API) |
| [React](https://react.dev/) | 19.2.6 | Client-side UI rendering |
| [TypeScript](https://www.typescriptlang.org/) | 6.0.3 | Type-safe development across client and server |
| [Hono](https://hono.dev/) | 4.12.18 | Lightweight HTTP framework for server routes |
| [Vite](https://vite.dev/) | 8.0.12 | Build tooling and development server |
| [Tailwind CSS](https://tailwindcss.com/) | 4.3.0 | Build-time CSS processing (via Vite plugin) |
| [Redis](https://redis.io/) | Platform-managed | In-memory data store for caching and persistence |
| [Vitest](https://vitest.dev/) | 4.1.6 | Unit testing framework |

---

## License

MIT
