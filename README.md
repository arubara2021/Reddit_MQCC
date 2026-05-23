
# MQCC — Mod Queue Command Center

![Devvit](https://img.shields.io/badge/Platform-Devvit-FF4500?style=flat-square&logo=reddit)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-4.12-FF6B35?style=flat-square)
![Redis](https://img.shields.io/badge/Redis-Platform--managed-DC382D?style=flat-square&logo=redis&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

A real-time moderation dashboard for Reddit built on the Devvit platform. MQCC replaces the native flat mod queue with a priority-scored, context-enriched interface that detects coordinated spam patterns, surfaces anomaly alerts, exposes bulk action workflows, and provides a community-facing leaderboard — all within a single installable Devvit app.

---

## Demo

[![MQCC Demo Video](https://img.shields.io/badge/Watch_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/_-0PLfCFPYo)

## Table of Contents

- [The Problem](#the-problem)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Priority Scoring Algorithm](#priority-scoring-algorithm)
- [Pattern Detection](#pattern-detection)
- [Anomaly Detection](#anomaly-detection)
- [Community Leaderboard](#community-leaderboard)
- [Feature Breakdown](#feature-breakdown)
- [Server Modules](#server-modules)
- [Client Components](#client-components)
- [Redis Schema](#redis-schema)
- [API Endpoints](#api-endpoints)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Testing](#testing)
- [Built With](#built-with)

---

## The Problem

Reddit's native mod queue presents reported items as an unsorted flat list with no priority signal, no author context, and no pattern awareness. Moderators processing hundreds of items per week face five structural deficiencies:

**No severity ranking.** A post flagged by 15 accounts sits at the same visual weight as a single-report item. There is no mechanism to surface the most urgent items first.

**No inline user context.** Every reported item is evaluated in isolation. Account age, karma, prior mod actions, and queue appearance frequency are not visible without navigating to the user's profile page.

**No automated pattern recognition.** Coordinated spam rings posting links to the same domain, bot farms using sequential naming conventions, and report spikes from time-burst attacks all require manual identification by the moderator.

**No bulk operation support.** Cleaning a coordinated spam ring of 20 posts requires 20 individual approve/remove/ban cycles. There is no select-and-act workflow.

**No community transparency.** Non-moderator members have no visibility into community activity, which erodes trust in larger communities.

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
│  │                      │ leaderboardTracker.ts     │   │  │
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
│  │  submitPost     │  │  Community leaderboard        │  │
│  └─────────────────┘  │  Settings / Alert state       │  │
│                       └──────────────────────────────┘  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Devvit Triggers                                    │ │
│  │  onPostSubmit    → recordPost()                     │ │
│  │  onPostDelete    → removePost()                     │ │
│  │  onCommentSubmit → recordComment()                  │ │
│  │  onCommentDelete → removeComment()                  │ │
│  │  onAppInstall    → bootstrap first mod              │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Stack:**
- Frontend: React 19, TypeScript, Vite, custom CSS design system (no UI framework)
- Backend: Node.js 22 serverless (Devvit), Hono HTTP framework
- Storage: Redis (provided automatically by Devvit, zero infrastructure)
- Communication: Direct HTTP via `fetch` from client to `/api/*` endpoints
- Event-driven: Devvit triggers for realtime community activity tracking

---

## Data Flow

MQCC has two distinct data flows: the **Mod Dashboard** (mod queue enrichment) and the **Community View** (leaderboard tracking).

### Mod Dashboard — Queue Enrichment Flow

```
1. Mod opens Dashboard
2. Client calls GET /api/queue
3. queueFetcher.ts calls reddit.getModQueue({ subreddit, limit: 100 })
4. Raw items parsed into RawQueueItem[] (author names extracted as strings,
   report data extracted from reportReasons/modReports/numReports)
5. Snapshot cached in Redis (key: mqcc:queue:{subredditId}, TTL: 60s)
6. contextEnricher.ts processes authors in batches of 3:
   a. Check Redis cache (key: mqcc:u2:{username}, TTL: 1h)
   b. On cache miss: call reddit.getUserByUsername, compute account age/karma/status
   c. Merge with mod action history from mqcc:actions:{subredditId}
   d. Merge with queue appearance count from mqcc:appear:{username}
   e. Cache enriched UserContext in Redis
7. priorityScorer.ts computes PriorityScore for each item (pure function, no I/O)
8. incrementQueueAppearance called for each author (Redis INCR equivalent)
9. Items sorted by descending priority score
10. detectAnomalies() runs anomaly checks on enriched queue
11. detectPatterns() runs link cluster, time burst, and username pattern detection
12. Response: { items: EnrichedQueueItem[], groups: [], lastUpdated, anomalies, patterns }
```

### Community View — Leaderboard Flow

The Community View uses a **trigger-based, event-driven architecture** that works for both public and private subreddits.

```
REALTIME TRACKING (fires automatically on every post/comment):

1. User creates a new post in the subreddit
2. Devvit platform fires onPostSubmit trigger
3. triggers.ts receives the payload, extracts author name (using toStr()
   to handle object/string formats from the Reddit API)
4. leaderboardTracker.recordPost() is called:
   a. Loads leaderboard data from Redis (key: mqcc:lb:{subredditId})
   b. Checks if this postId already exists (deduplication)
   c. Increments author's postCount and totalActivity
   d. Adds post to author's recentPosts array
   e. Prepends entry to recentActivity feed
   f. Saves updated data back to Redis (TTL: 30 days)
5. Same flow for comments via onCommentSubmit → recordComment()

DELETION TRACKING:

6. User deletes a post
7. Devvit fires onPostDelete trigger
8. leaderboardTracker.removePost() is called:
   a. Loads leaderboard data from Redis
   b. Finds and removes the post from author's recentPosts
   c. Decrements postCount and totalActivity
   d. Filters the post out of recentActivity
   e. Saves updated data back to Redis

DATA RETRIEVAL (when Community View is opened):

9. Non-mod user opens Community View (or mod clicks Community tab)
10. Client calls GET /api/community?subreddit={name}
11. community.ts checks if leaderboard has been seeded (key: mqcc:lb:seeded:{subredditId})
12. If NOT seeded (first-time visit):
    a. Fetches mod queue via fetchModQueue()
    b. Seeds leaderboard with existing queue items via recordPost()
    c. Marks as seeded so this only happens once
13. If already seeded:
    a. Reads directly from leaderboard Redis key
14. Builds CommunityData response:
    - contributors: ranked by post count
    - commenters: ranked by comment count
    - karma: ranked by total activity (posts + comments)
    - trendingPosts: author's recent posts sorted by creation time
    - recentActivity: last 5 posts/comments with author and timestamp
    - stats: active authors count, total posts, health score
15. Response: { success: true, data: CommunityData }
16. Client renders leaderboard with rank badges, animated counters,
    viewer rank card, recent activity feed, and trending posts
```

### Why Trigger-Based?

| Approach | Public Sub | Private Sub | Accuracy |
|---|---|---|---|
| `getHotPosts`/`getNewPosts` | Works | 403 Forbidden | Live data |
| Mod queue fallback | Only reported items | Only reported items | Wrong data |
| **Devvit triggers** | **Works** | **Works** | **Realtime, all posts** |

The trigger-based approach works identically for both public and private subreddits because it captures activity at the moment it happens, without relying on listing APIs that are blocked on private communities.

### Action Execution Flow

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

The `alertSystem.ts` module runs continuously against the enriched queue and generates `Anomaly` objects when thresholds are crossed. Each anomaly type has a 2-minute cooldown (configurable via `TTL.ALERT_COOLDOWN_MS`) to prevent alert fatigue.

| Anomaly Type | Threshold | Severity |
|---|---|---|
| Report spike | > 15 total reports from >= 3 unique authors | `high` (> 30 reports = `critical`) |
| New account flood | >= 3 queue items from accounts < 7 days old | `high` (>= 5 = `critical`) |
| Repeat offenders | >= 2 users with >= 3 queue appearances | `medium` |
| Ban evasion | >= 2 previously actioned users with accounts < 30 days old | `critical` |

Anomaly state is persisted in Redis (`mqcc:alertstate:{subredditId}`) with a 24-hour TTL so cooldowns survive page refreshes.

---

## Community Leaderboard

The Community View is a public-facing leaderboard that tracks all posts and comments in the subreddit using Devvit's event-driven trigger system.

### How It Works

When the MQCC app is installed on a subreddit, it registers four Devvit triggers:

| Trigger | Event | Action |
|---|---|---|
| `onPostSubmit` | New post created | `recordPost()` — increments author's post count, adds to recent posts and activity feed |
| `onPostDelete` | Post deleted | `removePost()` — decrements post count, removes from recent posts and activity feed |
| `onCommentSubmit` | New comment created | `recordComment()` — increments author's comment count, adds to activity feed |
| `onCommentDelete` | Comment deleted | `removeComment()` — decrements comment count |

All leaderboard data is stored in a single Redis key per subreddit (`mqcc:lb:{subredditId}`) as a JSON blob containing per-user stats and a global activity feed.

### Data Structure

Each tracked user has:
- `postCount` — number of posts created
- `commentCount` — number of comments made
- `totalActivity` — posts + comments combined
- `recentPosts` — array of their recent posts (max 10) with title, permalink, timestamp
- `lastActive` — timestamp of their most recent activity

### First-Time Seed

On the first visit to the Community View, if the leaderboard is empty, the system seeds it from the mod queue cache. This is a one-time operation — after seeding, the `mqcc:lb:seeded:{subredditId}` flag is set and the queue fallback is never used again. All subsequent data comes exclusively from triggers.

### Limitation

Only activity that occurs **after app installation** is tracked. Historical posts cannot be reconstructed on private subreddits because the Reddit API blocks listing endpoints with 403 Forbidden. Public subreddits may have historical data seeded from the mod queue on first visit.

### Leaderboard Tabs

| Tab | Ranking | Description |
|---|---|---|
| Top Contributors | Post count | Users ranked by number of posts created |
| Most Comments | Comment count | Users ranked by number of comments made |
| Karma Leaders | Total activity | Users ranked by combined posts + comments |

### Visual Design

The Community View uses a distinct purple-tinted palette (`--pub-accent: #a855f7`) with gradient mesh backgrounds, animated number counters, rank badges for top 3 users, viewer rank card, and a "Powered by MQCC" footer — completely separate from the zinc-tinted mod dashboard.

---

## Feature Breakdown

### Mod Dashboard (Authenticated View)

**Priority Queue.** Fetches the mod queue via `reddit.getModQueue`, enriches each item with user context from the Reddit API, scores it through the priority algorithm, and renders items sorted by descending score. Each item displays a color-coded priority dot, content type (POST/COMMENT), author name, report count, and inline user context (account age, karma, prior actions, queue appearances).

**Filter Bar.** Filters the rendered queue by: All, Posts, Comments, Critical severity, High severity. Additionally supports sorting by: Priority, Newest, Oldest. Filtering operates on the already-fetched enriched dataset — no additional API calls.

**Author Search.** Text input to filter queue items by author name. Searches are case-insensitive and match partial names.

**Detail Modal.** Full-item view showing: content body, author profile (account age, total/post/comment karma, queue appearances, prior mod actions, last action type and timestamp), report reasons as pill badges, priority factors as warning pills, and a permalink button that copies the item URL to clipboard.

**Bulk Action Bar.** Sticky bottom bar that appears when one or more items are selected. Supports: Approve selected, Remove selected, Ban selected users, Remove and Ban in one step. Ban duration is configurable: Permanent, 1, 3, 7, 14, or 30 days. The bar shows the selected count and a "Clear" button.

**Pattern Alerts.** Rendered at the top of the queue tab when `patternDetector.ts` identifies link clusters, time bursts, or username patterns. Each alert shows the pattern type, affected count, and for link clusters, the shared domain.

**Anomaly Banner.** Displays the highest-severity anomaly from `alertSystem.ts` at the top of the queue tab. Shows severity badge, title, description, and "+N more alerts" if multiple anomalies exist. Dismissible per-session.

**Workload Tab.** Fetches data from `activityTracker.ts` and renders: three-stat grid (total actions, active mods, flagged users), actions-by-type horizontal bar chart (approve/remove/ban/lock with percentage breakdowns), per-mod activity breakdown with proportional bars, top flagged users table ranked by action count with severity coloring (>= 5 actions = red, >= 3 = orange), and a recent action feed (last 15 actions with timestamp-relative display).

**Alerts Tab.** Displays all active anomalies with severity badges, titles, descriptions, and affected author lists. Color-coded by severity with left-border indicators.

**Settings Tab.** Persistent configuration stored in Redis via `settings.ts`:
- Auto-refresh toggle (on/off)
- Refresh interval selector (10s, 30s, 1m, 2m, 5m)
- Compact mode toggle
- Group spam rings toggle
- Anomaly alerts toggle
- Reset all stored data button (clears queue cache, mod action history, anomaly state, stored mod list, settings, and leaderboard data)

**Keyboard Shortcuts.**
- `r` — Refresh queue
- `a` — Approve selected items
- `x` — Remove selected items
- `Escape` — Deselect all, close modals, clear filters

**Community View Toggle.** Mods can switch to the Community View to see the public-facing leaderboard without leaving the dashboard.

### Community View (Public / Non-Mod View)

When the `permissions.ts` module determines the current user is not a moderator (or when a mod clicks the Community button), the client renders the `PublicDashboard.tsx` component.

**Hero Card.** Displays subreddit name, active user count, and total post count with animated number counters.

**Leaderboard.** Three tabs: Top Contributors (ranked by post count), Most Comments (ranked by comment count), Karma Leaders (ranked by total activity). Each entry shows rank number, user avatar initial, username, score bar, and score value. Top 3 users get special rank badges and gradient backgrounds. The current viewer's rank is highlighted with a purple accent and "You" badge.

**Viewer Rank Card.** If the current user appears in the active leaderboard, a dedicated card shows their rank number, username, and score.

**Recent Activity.** Feed showing the last 5 community actions with action type (post/comment), author name, and relative timestamp.

**Trending Posts.** Cards showing recent posts with title, author, and timestamp. Click to copy permalink to clipboard.

**Visual Design.** The public dashboard uses a distinct purple-tinted palette (`--pub-accent: #a855f7`) with gradient mesh backgrounds, animated number counters, and a "Powered by MQCC" footer — completely separate from the zinc-tinted mod dashboard.

### Splash Screen (Inline Feed View)

Rendered in the Reddit feed via `splash.html`. Displays a compact card with blue accent showing the shield icon, subreddit name, and "Tap to explore leaderboard". Uses Space Grotesk and JetBrains Mono fonts. Fetches `/api/init` to resolve the subreddit name. Acts as the entry point to the full dashboard.

---

## Server Modules

| Module | File | Responsibility |
|---|---|---|
| Queue Fetcher | `queueFetcher.ts` | Fetches mod queue from Reddit via `getModQueue`, parses raw items into `RawQueueItem[]`, extracts author names as strings (handles object formats via `toStr()`), extracts report data from `reportReasons`/`modReports`/`numReports` fields, caches snapshot in Redis with 60s TTL, falls back to cache on API failure |
| Context Enricher | `contextEnricher.ts` | Fetches user profiles via `getUserByUsername`, computes account age in days, extracts post/comment/total karma, detects suspended/shadowbanned status, merges with mod action history and queue appearance counts from Redis, caches enriched `UserContext` with 1-hour TTL, processes authors in batches of 3 to avoid rate limiting. Uses `toStr()` defensive conversion for all username inputs |
| Priority Scorer | `priorityScorer.ts` | Pure function: `(RawQueueItem, UserContext) => PriorityScore`. Seven-factor weighted scoring algorithm. Score 0-100 with four severity levels. |
| Pattern Detector | `patternDetector.ts` | Pure function: `(EnrichedQueueItem[]) => PatternResult`. Three detection methods: link clusters via domain extraction, time bursts via 1-hour sliding window, username patterns via regex matching. |
| Alert System | `alertSystem.ts` | Stateful anomaly detection with Redis-backed cooldown. Four checks: report spike, new account flood, repeat offenders, ban evasion. Alert state persisted with 24h TTL. |
| Leaderboard Tracker | `leaderboardTracker.ts` | Event-driven community activity tracking. Stores per-user post/comment counts and recent posts in a single Redis JSON blob. Functions: `recordPost()`, `recordComment()`, `removePost()`, `removeComment()`, `getLeaderboard()`. Handles seed-once logic via `isSeeded()`/`markSeeded()`. Uses `toStr()` defensive conversion for all author inputs to handle Reddit API object/string variations |
| Mod Actions | `modActions.ts` | Executes Reddit API calls: `approve`, `remove`, `lock`, `banUser`. Each action records a `ModActionRecord` in Redis (max 500 records, 30-day TTL). Ban duration normalized to nearest valid value from `[0, 1, 3, 7, 14, 30]`. |
| Activity Tracker | `activityTracker.ts` | Aggregates mod action history into workload statistics: actions by mod, by type, by hour, by day. Computes coverage gaps (hours with zero activity). Identifies top flagged users. Generates leaderboards (contributors/comments/karma) filtered by time range. Results cached for 5-15 minutes. |
| Permissions | `permissions.ts` | Resolves current user via `reddit.getCurrentUsername`, checks against stored moderator list in Redis. First user bootstrapped as moderator on initial setup. Provides `requireMod()` guard for protected endpoints. |
| Rate Limiter | `rateLimiter.ts` | Sliding-window rate limiter backed by Redis. Default: 30 req/min. Action endpoints: 10 req/min. Bulk operations: 5 req/5min. Fails open on Redis errors. |
| Cache | `cache.ts` | Generic Redis cache wrapper: `getCached<T>`, `setCached`, `deleteCached`, `cacheExists`. All operations wrapped in try-catch with structured logging on failure. |
| Settings | `settings.ts` | Reads/writes per-subreddit settings in Redis. Validates priority weights sum to ~1.0 (normalizes if not). Clamps refresh interval to 10s-300s range. |
| Logger | `logger.ts` | Structured JSON logger writing to `console.log`/`console.warn`/`console.error`. Every entry includes `timestamp`, `module`, `level`, `message`, and optional data fields. |
| Post | `post.ts` | Creates and searches for dashboard posts via `reddit.submitCustomPost` and `reddit.getHotPosts`. |
| Constants | `constants.ts` | Redis key patterns, TTL values, default settings. Defines all `REDIS_KEYS` and `TTL` constants used across the server. |

---

## Client Components

| Component | Responsibility |
|---|---|
| `Dashboard.tsx` | Root orchestrator. Resolves mod status via `/api/init`, routes to `PublicDashboard` or mod view. Manages tab state (queue/workload/alerts/settings), filter state, sort state, author search, selection state, bulk action flow, confirmation dialogs, toast notifications, keyboard shortcuts, and community view toggle. Fetches anomalies and patterns on mount. |
| `PriorityQueue.tsx` | Renders grouped items (spam rings, time bursts, coordinated accounts) above individual items. Groups display pattern label, severity badge, affected authors, shared domains, and expandable item list with group-level "Remove All" / "Ban All" actions. Individual items sorted by descending priority score. |
| `QueueItem.tsx` | Single queue row: checkbox for selection, priority color dot, content type label, author name, report count, priority score, content preview (clickable for detail modal), report reason pills, inline `ContextCard`, and action buttons (Approve/Remove/Ban/Spam). Supports compact mode. Shows handled badge after action. |
| `DetailModal.tsx` | Full overlay showing: priority badge with score, content body, author profile with `ContextCard`, user details grid (account age, total/post/comment karma, queue appearances, prior actions, last action), report reasons, priority factors, permalink copy button with feedback, ban duration selector, and action buttons. |
| `BulkActionBar.tsx` | Sticky bottom bar: selected count display, "Clear" button, ban duration dropdown (Permanent/1/3/7/14/30 days), and four action buttons (Approve/Remove/Ban/R+B). Memoized with `React.memo`. |
| `WorkloadTab.tsx` | Fetches via `useWorkload` hook. Renders: stat grid, actions-by-type bar chart, per-mod activity bars, top flagged users list, recent actions feed (last 15). Each section has loading/error/empty states. |
| `PublicDashboard.tsx` | Community-facing leaderboard view: hero card with active/post stats and animated counters, three leaderboard tabs with rank badges and proportional bars, time range dropdown, viewer rank card, recent activity feed, trending posts, copy-to-clipboard for user profiles and permalinks, "Powered by MQCC" footer. Fetches from `/api/community`. |
| `ContextCard.tsx` | Inline user context: account age in days, total karma, conditional badges (Suspended, Shadowbanned, New account, Low karma, N prior actions, Repeated Nx). Memoized. |
| `PatternAlert.tsx` | Renders link clusters (blue), time bursts (yellow), and username patterns (accent) as colored alert cards with count badges. Dismissible. |
| `AlertBanner.tsx` | Renders the highest-severity anomaly with severity badge, title, description, "+N more" count, and dismiss button. Color-coded by severity. |
| `ConfirmDialog.tsx` | Confirmation modal for destructive actions. Shows warning icon for danger actions, title, message, Cancel/Confirm buttons with loading state. |
| `EmptyState.tsx` | Centered empty state with checkmark icon, title, and description. Memoized. |
| `LoadingState.tsx` | Centered spinner with configurable message. Memoized. |
| `ErrorBoundary.tsx` | React error boundary with error message display and reload button. Catches unhandled rendering errors and prevents full-page crashes. |

### Custom Hooks

| Hook | Endpoint | Behavior |
|---|---|---|
| `useQueue` | `GET /api/queue` | Fetches enriched queue, stores items + groups + lastUpdated + anomalies + patterns. Supports auto-refresh with configurable interval (clamped 10s-300s). Deduplicates concurrent fetches via `fetchingRef`. |
| `useWorkload` | `GET /api/workload` | Fetches workload statistics (actions by mod/type/hour/day, recent actions, coverage gaps, top flagged users). |
| `useSettings` | `GET/POST /api/settings` | Reads and writes per-subreddit settings. `resetSettings` calls `POST /api/settings/reset`. Falls back to `DEFAULT_SETTINGS` on error. |
| `usePatterns` | `GET /api/patterns` | Fetches pattern detection results (link clusters, time bursts, username patterns). |

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
| `mqcc:anomalies:{subredditId}` | Array of persisted `Anomaly` objects | 5 minutes |
| `mqcc:storedmods:{subredditId}` | Array of moderator usernames | 365 days |
| `mqcc:setup:{subredditId}` | `"true"` string flag | 365 days |
| `mqcc:ratelimit:{identifier}` | Array of request timestamps | 2x window |
| `mqcc:lb:{subredditId}` | Community leaderboard data (users map + activity feed) | 30 days |
| `mqcc:lb:seeded:{subredditId}` | `"true"` string flag — prevents re-seeding from queue | 30 days |

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
| GET | `/api/community?subreddit=` | Fetch community leaderboard data | None |
| POST | `/api/cleanup` | Clear all cached data including leaderboard | Mod |
| POST | `/api/action/approve` | Approve a single item | Mod |
| POST | `/api/action/remove` | Remove a single item | Mod |
| POST | `/api/action/lock` | Lock a single item | Mod |
| POST | `/api/action/ban` | Ban a user | Mod |
| POST | `/api/action/removeAndBan` | Remove item and ban author | Mod |
| POST | `/api/action/bulk` | Execute bulk action on multiple items | Mod |

### Internal Endpoints (Devvit)

| Method | Path | Purpose |
|---|---|---|
| POST | `/internal/menu/create-post` | Create dashboard post from subreddit menu |
| POST | `/internal/form/ban-user` | Handle ban user form submission |
| POST | `/internal/form/bulk-ban` | Handle bulk ban form submission |
| POST | `/internal/form/remove-and-ban` | Handle remove and ban form submission |
| POST | `/internal/trigger/on-install` | Bootstrap first moderator on app install |
| POST | `/internal/trigger/on-post-submit` | Track new post in community leaderboard |
| POST | `/internal/trigger/on-post-delete` | Remove deleted post from community leaderboard |
| POST | `/internal/trigger/on-comment-submit` | Track new comment in community leaderboard |
| POST | `/internal/trigger/on-comment-delete` | Remove deleted comment from community leaderboard |

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

**Important:** After deploying code that adds new triggers, you must **uninstall and reinstall** the app on your subreddit for the new triggers to be registered by the Devvit platform.

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
6. The Community View is accessible to all users (mods and non-mods)

**Requirements:** The installing user must have full moderator permissions. The app stores data in Devvit-managed Redis — no external database or API keys required.

**Post-installation:** After installation, the first moderator is automatically bootstrapped. New posts and comments begin tracking immediately in the community leaderboard. Historical posts may appear if the subreddit is public and the mod queue contains reported items.

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
      Dashboard.tsx            Root component: tab routing, state orchestration, keyboard shortcuts
      DetailModal.tsx          Full item detail with user profile, actions, permalink copy
      EmptyState.tsx           Empty state placeholder
      ErrorBoundary.tsx        React error boundary with reload fallback
      LoadingState.tsx         Loading spinner
      PatternAlert.tsx         Pattern detection alert cards (dismissible)
      PriorityQueue.tsx        Grouped + individual queue rendering
      PublicDashboard.tsx      Community-facing leaderboard with animated counters
      QueueItem.tsx            Single queue row with actions and handled badge
      WorkloadTab.tsx          Mod activity analytics
    hooks/
      usePatterns.ts           Pattern detection data fetching
      useQueue.ts              Queue data fetching with auto-refresh and anomaly/pattern bundling
      useSettings.ts           Settings read/write with defaults and reset
      useWorkload.ts           Workload statistics fetching
    utils/
      time.ts                  Relative timestamp formatting
    dashboard.html             Expanded view HTML shell
    dashboard.tsx              Expanded view React entry point
    splash.html                Inline view HTML shell
    splash.tsx                 Inline view React entry point
    index.css                  Design system: tokens, components, responsive, public dashboard styles
    module.d.ts                TypeScript module declarations
  server/
    core/
      activityTracker.ts       Mod action aggregation and workload/leaderboard generation
      alertSystem.ts           Anomaly detection with cooldown state
      cache.ts                 Redis cache wrapper (get/set/delete/exists)
      constants.ts             Redis key patterns, TTL values, default settings
      contextEnricher.ts       User profile fetching, context building, batching, defensive name extraction
      logger.ts                Structured JSON logger
      leaderboardTracker.ts    Event-driven community activity tracking (record/remove post/comment, seed-once)
      modActions.ts            Reddit API action execution (approve/remove/ban/lock)
      patternDetector.ts       Link cluster, time burst, username pattern detection
      permissions.ts           User resolution, mod list management, bootstrap
      post.ts                  Dashboard post creation and search
      priorityScorer.ts        Seven-factor priority scoring algorithm
      queueFetcher.ts          Mod queue fetching, parsing, domain extraction, defensive author name handling
      rateLimiter.ts           Sliding-window rate limiter
      settings.ts              Per-subreddit settings read/write/validate
    routes/
      api.ts                   REST API handler with cleanup including leaderboard keys
      community.ts             Community leaderboard data with seed-once logic and queue fallback
      forms.ts                 Form submission handlers (ban, bulk-ban, remove-and-ban)
      menu.ts                  Subreddit menu action handler
      triggers.ts              Devvit trigger handlers (install, post/comment submit/delete) with raw payload logging
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
devvit.json                    Devvit app configuration with trigger registrations
vite.config.ts                 Vite build configuration
eslint.config.js               ESLint configuration
tsconfig.json                  TypeScript project references
package.json                   Dependencies and scripts
vitest.config.ts               Vitest test configuration
```

---

## Design Decisions

**No UI framework.** Every component is styled with CSS custom properties defined in `index.css`. This eliminates framework dependency weight, avoids lock-in to any component library's design language, and provides full control over responsive behavior. The design system uses 40+ CSS custom properties for colors, spacing, radius, shadows, and typography.

**Redis for all persistence.** Mod action history, user context cache, queue snapshots, settings, alert state, rate limiter state, moderator lists, and community leaderboard all reside in Redis. The Devvit platform provisions Redis automatically with no configuration required. There is no external database, no migrations, no connection management.

**Server-side enrichment.** User context is fetched and cached on the server in `contextEnricher.ts`, not on the client. The client receives fully enriched data in a single `/api/queue` call. This avoids dozens of individual profile requests from the browser, reduces client complexity, and keeps Reddit API interactions in the serverless environment where they are authenticated.

**Trigger-based community tracking.** Rather than relying on Reddit listing APIs (which fail on private subreddits with 403 Forbidden), the community leaderboard uses Devvit's event-driven trigger system. `onPostSubmit` and `onCommentSubmit` triggers fire automatically for every new post and comment, storing activity in Redis. This works identically for both public and private subreddits.

**Graceful degradation.** Every external call — Reddit API, Redis reads/writes, user profile fetches — is wrapped in try-catch with fallback behavior. Queue fetch failure returns cached snapshot. User profile unavailability returns default context with `-1` sentinel values for unknown fields. Anomaly detection failure returns an empty array. The dashboard remains functional even when individual subsystems fail.

**Batch processing with rate limit awareness.** User context enrichment processes authors in batches of 3 (`Promise.allSettled`) to avoid hitting Reddit API rate limits. The rate limiter module enforces per-action (10/min) and per-bulk-operation (5/5min) limits independently.

**Defensive name extraction.** The Reddit API inconsistently returns author names as either strings or objects (e.g., `{name: "username", id: "t2_xxx"}`). All code paths use a `toStr()` helper that checks for both formats, with explicit detection and logging of `[object Object]` to catch edge cases. This defensive approach is applied in `queueFetcher.ts`, `contextEnricher.ts`, `leaderboardTracker.ts`, and `triggers.ts`.

**Seed-once pattern.** The community leaderboard uses a seed-once mechanism: on first visit, existing queue data seeds the leaderboard and a flag (`mqcc:lb:seeded:{subredditId}`) is set in Redis. Subsequent visits read only from the leaderboard key, never re-seeding. This prevents deleted posts from reappearing through queue fallbacks.

**Separate visual identities.** The mod dashboard uses a zinc-tinted dark palette (`--bg-base: #000000`, accent purple `#8b5cf6`) optimized for dense information display. The public dashboard uses a purple-tinted palette (`--pub-accent: #a855f7`) with gradient backgrounds and animated counters, designed for community engagement rather than data density. The splash screen uses a blue accent (`#3b82f6`) on dark blue, optimized for feed visibility.

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
| [Devvit](https://developers.reddit.com/) | 0.12.23 | Reddit developer platform (serverless, Redis, Reddit API, triggers) |
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
