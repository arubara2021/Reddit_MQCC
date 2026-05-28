
<div align="center">

# queuezero

### Priority-Scored Moderation for Reddit

A real-time moderation dashboard that turns the flat mod queue into an intelligent command center. See what matters first, act faster, and let your community see itself grow.

[![Platform](https://img.shields.io/badge/Platform-Devvit-FF4500?style=flat-square&logo=reddit&logoColor=white)](https://developers.reddit.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**[Install from App Directory](https://developers.reddit.com/apps/queuezero)** | **[Watch Demo](https://youtu.be/7FU9GlGYx6Q)**

</div>

---

## Why I Built This

I moderate a subreddit. Every week, I open the mod queue and see the same thing: a flat list of reported items with no signal, no priority, no sense of what actually needs my attention first. A post reported by fifteen coordinated bot accounts looks exactly the same as a single report from a five-year community member. I would spend twenty minutes clicking through items one by one, opening each author's profile, checking their history by hand, trying to remember which domains I had seen before. Then I would do it again the next day.

Reddit's native mod tools are powerful, but the queue itself has not evolved. There is no scoring, no pattern detection, no way to act on twenty spam posts at once. The gap between what moderators need and what the queue provides has been growing for years, and nobody had filled it.

So I built queuezero.

---

## What It Does

### The Problem

Reddit's native mod queue presents reported items as an unsorted flat list. Moderators processing hundreds of items per week face five structural gaps:

| Gap | Impact |
|:--|:--|
| No severity ranking | A 15-report post looks the same as a single-report item |
| No inline user context | Every item evaluated in isolation without account history |
| No pattern awareness | Coordinated spam and ban evasion require manual identification |
| No bulk operations | Cleaning 20 spam posts means 20 individual action cycles |
| No community transparency | Non-mod members have no visibility into community activity |

queuezero resolves all five in a single Devvit installation.

### The Solution

Every reported item is scored from 0 to 100 using a weighted algorithm. The score is based on eight factors: how many reports the item has, how old the author's account is, their karma, how many times they have appeared in the queue before, whether they have been actioned by moderators previously, their account status (shadowbanned, suspended), and whether spam keywords appear in the report reasons. Critical items score 80 or above and sit at the top of the queue, glowing red. A single report against a longtime community member with thousands of karma scores 8 and sinks to the bottom. The queue finally tells you where to start.

On top of scoring, queuezero automatically detects coordinated spam patterns, monitors for anomalies, surfaces ban evasion, and gives moderators bulk actions to clean entire spam rings in seconds.

For the community, a public leaderboard tracks every post and comment in real time and gives every subreddit member a reason to engage beyond just reading.

---

## Demo

<div align="center">

[![Watch the Demo](https://img.shields.io/badge/WATCH_DEMO-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/7FU9GlGYx6Q)

</div>

---

## Features

### Mod Dashboard

The primary view for moderators. Every feature is designed to reduce the time between opening the queue and taking action.

| Feature | Description |
|:--|:--|
| **Priority Scoring** | Weighted algorithm scores every item 0 to 100 based on report count, account age, karma, queue history, prior mod actions, account status, and spam keywords in report reasons. Items sorted by descending score. |
| **Inline User Context** | Account age, karma, action history with specific actions and dates, subreddit posting history, and queue appearance count visible on every row. No clicks needed. |
| **Pattern Detection** | Identifies link clusters where multiple accounts share the same domain, time bursts where a flood of items arrives from new accounts within one hour, and username patterns that match bot naming conventions. |
| **Ban Evasion Detection** | Stores domains from banned users' content and cross-references new queue items. Combines domain matching with username similarity analysis using string comparison and prefix matching. |
| **Anomaly Alerts** | Detects report spikes tracked by velocity against historical averages, new account floods from accounts less than 7 days old, repeat offenders with multiple queue appearances, and ban evasion. 2-minute cooldowns prevent alert fatigue. |
| **Bulk Actions** | Select multiple items. Approve, remove, ban, or remove-and-ban in one step. Domains from banned content stored automatically for future evasion detection. |
| **Ban Management** | View all banned users with duration, reason, issuing moderator, and one-click unban. |
| **Workload Analytics** | Mod team activity breakdown with per-moderator stats, top flagged users, and recent action feed. |
| **Settings** | Auto-refresh with configurable intervals (10s to 5min), compact mode, spam ring grouping toggle, anomaly alerts toggle, community leaderboard visibility, and full data reset. All settings persist per-subreddit in Redis. |
| **Keyboard Shortcuts** | `R` refresh queue, `A` approve selected, `X` remove selected, `Esc` dismiss selection or close modals. |
| **Cached Data Indicator** | When Reddit's API is slow, the queue shows cached data with a banner and retry button instead of blocking. |
| **From-Cache Detection** | The server compares Redis snapshot timestamps before and after fetching to detect stale data and passes a `fromCache` flag to the client. |

### Community View

A public-facing view accessible to every subreddit member, not just moderators.

| Feature | Description |
|:--|:--|
| **Leaderboard** | Three ranked tabs: top contributors by post count, most active commenters by comment count, and karma leaders by total activity. |
| **Viewer Rank** | Every member sees their own position highlighted with a dedicated rank card showing their score and placement. |
| **Time Range Filtering** | Switch between This Week, This Month, and All Time. Rankings filter in real time using timestamped activity data stored in Redis sorted sets. |
| **Trending Posts** | Recent posts with author attribution and timestamps. Tap to copy permalink to clipboard. |
| **Activity Feed** | Last 5 community actions displayed in real time. |
| **Private Sub Support** | Works on both public and private subreddits via Devvit's trigger system. Reddit's listing APIs return 403 on private communities, but triggers fire regardless of visibility. |
| **Smooth Range Switching** | Switching time ranges shows an inline loading indicator instead of a full-page flash. Current data stays visible while new data loads. |

### Mod Actions

Every standard moderation action is supported directly within the app:

| Action | Description |
|:--|:--|
| **Approve** | Clear the report and restore the item |
| **Remove** | Remove the item from the subreddit |
| **Lock** | Lock the item to prevent new comments |
| **Ban** | Ban the author with configurable duration (permanent, 1, 3, 7, 14, or 30 days) |
| **Unban** | Remove a ban |
| **Remove and Ban** | Remove the content and ban the author in a single action |
| **Bulk** | Execute any of the above on multiple selected items at once |

All actions are rate-limited to prevent accidental mass operations. Individual actions are limited to 10 per minute per moderator. Bulk actions are limited to 5 per 5 minutes. A confirmation dialog appears before any ban or bulk action. The queue refreshes automatically after actions to reflect changes.

---

## Architecture

```
Reddit.com (iframe)
+------------------------------------------------------+
|  React 19 Client                                      |
|  Dashboard / PublicDashboard / Splash                 |
+---------------------------+--------------------------+
                            |
                     HTTP (fetch)
                            |
+---------------------------v--------------------------+
|  Hono Server (Devvit Serverless)                     |
|                                                      |
|  Routes             Core Modules                     |
|  --------           ------------                     |
|  /api/*             queueFetcher    patternDetector   |
|  /community/*       contextEnricher alertSystem       |
|                     priorityScorer  leaderboardTracker|
|                     modActions      activityTracker   |
|                     permissions     rateLimiter       |
|                     settings        cache  logger     |
+-------------------+------------------+--------------+
                    |                  |
          Reddit API             Redis (managed)
          getModQueue            Queue snapshots
          getUserByUsername      User context cache
          approve/remove/ban    Mod action history
          submitCustomPost      Community leaderboard
+-------------------+------------------+--------------+
|  Devvit Triggers                                     |
|  onPostSubmit/onDelete  onCommentSubmit/onDelete     |
|  onAppInstall                                        |
+------------------------------------------------------+
```

**Stack:** React 19 / TypeScript 6 / Hono / Devvit Serverless / Redis / Vite

### Key Design Decisions

**Server-side enrichment.** User profiles are fetched and cached on the server in batches of 15, not individually from the browser. This avoids dozens of individual profile requests from the client and keeps all Reddit API interactions inside the authenticated serverless environment. The client receives fully enriched data in a single API call. Within each batch, requests are parallelized via `Promise.allSettled` for throughput, while batches themselves are processed sequentially to stay within API limits. Results are cached for 1 hour in Redis, so repeat visits within that window require zero Reddit API calls.

**Pure scoring function.** The priority scoring algorithm takes a raw queue item and a user context object and returns a score between 0 and 100 with a severity level and a list of contributing factors. It performs no I/O, makes no API calls, and produces the same output for the same input. This made comprehensive unit testing straightforward and guarantees deterministic queue ordering.

**Trigger-based leaderboard.** The community leaderboard uses Devvit's `onPostSubmit`, `onCommentSubmit`, `onPostDelete`, and `onCommentDelete` triggers instead of Reddit's listing APIs. This works identically on both public and private subreddits. Activity is recorded at the moment it happens, so the leaderboard is always current without polling.

**Defensive error handling.** Every Redis read, every API call, every enrichment step is wrapped in try-catch with fallback behavior. If the queue fetch fails, the cached snapshot is returned. If a user profile is unavailable, default values with `-1` sentinels are used. If anomaly detection throws, an empty array is returned. The dashboard stays functional even when individual components fail. A moderator should never see a blank screen because one API call timed out. Rate limiters fail open — if Redis is unavailable, requests are allowed through rather than blocking legitimate moderation work.

**Hardcoded thresholds with clear rationale.** Scoring weights, pattern detection thresholds, and anomaly triggers are fixed values chosen through testing against real moderation scenarios. This trade-off favors reliability and predictability over configurability. The thresholds are tuned so that the most dangerous items consistently surface to the top across a range of subreddit sizes. Configurable priority weights are architecturally supported (the scoring function accepts a weights parameter, and settings persistence is in place) but not yet wired into the scoring calculation. This is a planned enhancement for communities that need custom tuning.

---

## Priority Scoring

Every reported item passes through a weighted algorithm:

```
Score: 0 -----> 30 -----> 55 -----> 80 -----> 100
       |        |          |         |         |
       low      medium     high      critical
      (gray)   (yellow)  (orange)    (red)
```

### Scoring Factors

| Factor | Max Points | Logic |
|:--|:--|:--|
| Report count | 40 | `(reportCount / 5) * 40`, capped at 40 |
| Account age | 25 | `< 1 day` = 25, `< 7 days` = 20, `< 30 days` = 10, `30+` = 0 |
| Karma | 20 | `0 karma` = 20, `< 10` = 15, `< 50` = 5, `50+` = 0 |
| Queue history | 15 | `5+ appearances` = 15, `3-4` = 10, `2` = 5 |
| Prior mod actions | 10 | `3+ actions` = 10, `1-2` = 5 |
| Shadowbanned | +15 | Flat bonus |
| Suspended | +15 | Flat bonus |

### Spam Keywords

Report reasons are scanned for `spam`, `scam`, `bot`, `phishing`, `fake`, and `fraud`. Each unique keyword found across all report reasons adds 10 points, once per keyword. Each report reason contributes at most one keyword hit (the first match in the keyword list) to prevent double-counting from reasons like "spam bot scam" that contain multiple keywords.

Unknown values (sentinel `-1`) are excluded from scoring. Final score capped at 100.

### Scoring Examples

| Scenario | Breakdown | Score | Level |
|:--|:--|:--|:--|
| 2-year account, 5000 karma, 1 report | 8 + 0 + 0 + 0 + 0 | **8** | low |
| 10-day account, 30 karma, 2 reports | 16 + 10 + 5 + 0 + 0 | **31** | medium |
| 5-day account, 2 karma, 3 reports, "spam" in reason | 24 + 20 + 15 + 0 + 0 + 10 | **69** | high |
| Brand new account, 0 karma, 5 reports, "spam bot" in reason | 40 + 25 + 20 + 0 + 0 + 10 | **95** | critical |
| Shadowbanned, 0 karma, 3 reports, new account | 24 + 25 + 20 + 0 + 0 + 15 | **84** | critical |

---

## Pattern Detection

| Pattern | Method | Threshold |
|:--|:--|:--|
| **Link clusters** | Extracts domains from body, url, and title fields using regex. Strips `www.` prefix and normalizes paths. | 2+ unique authors sharing the same domain |
| **Time bursts** | 1-hour sliding window over post timestamps with a two-pointer approach | 3+ items in the window with 2+ from accounts less than 7 days old |
| **Username patterns** | Regex matching against 5 pattern types. Case-insensitive. | 3+ unique accounts matching the same pattern |

### Username Patterns Detected

| Pattern | Regex | Example |
|:--|:--|:--|
| name + numbers | `/([a-z]+)\d{2,4}$/i` | `john_1234`, `user5678` |
| name_name | `/^([a-z]+)_([a-z]+)/i` | `auto_poster`, `test_account` |
| `auto_` prefix | `/^auto_/i` | `auto_submit`, `auto_share` |
| `bot_` prefix | `/^bot_/i` | `bot_user1`, `bot_poster` |
| Repeated characters | `/(\w)\1{3,}/` | `aaaa_spam`, `spamspam` |

Groups appear inline in the queue with clear labels, affected author lists, and their own priority score based on the highest-scoring item in the group. Each group card provides one-click "Remove All" and "Select for Ban" actions to act on the entire ring at once.

---

## Ban Evasion Detection

Cross-references queue items against users banned within the last 72 hours using two signal types:

| Method | How It Works |
|:--|:--|
| **Domain matching** | Stores domains extracted from every banned user's content at ban time. New queue items from accounts less than 30 days old are scanned for overlapping domains. Even one shared domain triggers a flag. |
| **Username similarity** | Compares new queue item authors against recently banned usernames using a character-overlap similarity function (threshold: 0.6) and 4-character prefix matching. Accounts with names like `john_doe_2` matching a banned `john_doe` get flagged. |

Neither signal alone is proof of evasion. A ban evasion alert requires at least 2 suspect accounts to reduce false positives from coincidental matches. Combined, the signals surface accounts worth investigating. Domains from banned content are stored automatically whenever a Ban or Remove and Ban action is executed through queuezero.

---

## Anomaly Detection

| Anomaly | Condition | Severity |
|:--|:--|:--|
| **Report spike** | 15+ reports from 3+ unique authors. Severity escalates to critical when report velocity exceeds 2.5x the historical average or total reports exceed 30. | High, escalating to Critical |
| **New account flood** | 3+ queue items from accounts less than 7 days old | High (5+ = Critical) |
| **Repeat offenders** | 2+ users with 3+ queue appearances | Medium |
| **Ban evasion** | New accounts matching banned user domains or usernames, with at least 2 suspects | Critical |

Each anomaly type has a 2-minute cooldown to prevent alert fatigue. Anomaly state persists across page refreshes via Redis with a 5-minute TTL. Alerts are color-coded by severity and include affected usernames.

---

## Data Flow

### Mod Queue Enrichment

```
1. Moderator opens the Dashboard
2. Client requests GET /api/queue
3. Server fetches mod queue from Reddit API (max 100 items)
4. Raw items parsed and cached in Redis (60s TTL)
5. User profiles resolved with deduplication — same author fetched once
6. Uncached profiles fetched in batches of 15 from Reddit API
7. Context enriched with action history, queue appearances,
   and subreddit posting history from Redis
8. Priority score computed for each item (pure function)
9. Pattern detection, anomaly analysis, and spam ring grouping run
10. Fully enriched items returned, sorted by descending score
```

The server detects whether the returned data is from a fresh API fetch or a cached Redis snapshot by comparing snapshot timestamps before and after the fetch. A `fromCache` flag is sent to the client, which displays a yellow indicator banner with a retry button when stale data is shown.

### Community Leaderboard

```
1. User creates a post or comment
2. Devvit trigger fires (onPostSubmit / onCommentSubmit)
3. Leaderboard tracker increments counts in Redis hashes
   and records activity in a timestamped sorted set
4. User deletes a post or comment
5. Devvit trigger fires (onPostDelete / onCommentDelete)
6. Leaderboard tracker decrements counts
7. Community View loads leaderboard directly from Redis
8. Time-range filtering uses the sorted set timestamps
   to return only activity within the selected window
```

Trigger-based tracking works identically on public and private subreddits because it captures activity at the moment it happens, without relying on Reddit's listing endpoints.

### Seed-on-First-Visit

When a Community View is opened for the first time, the leaderboard is empty because no triggers have fired yet. The system handles this with a two-tier approach:

1. **Primary seed:** Fetches the subreddit's 100 most recent posts via `reddit.getNewPosts` and records them as initial leaderboard data. This works on public subreddits and provides real community data from the start.
2. **Fallback seed (private subreddits only):** If `getNewPosts` returns no data (which happens on private communities due to API 403s), the system falls back to the mod queue as an initial data source. This is temporary — as trigger data accumulates, it overwrites the seed data.

A Redis flag ensures seeding only happens once. After that, all data comes exclusively from triggers.

---

## API Endpoints

| Method | Path | Purpose |
|:--|:--|:--|
| GET | `/api/init` | Resolve user identity and mod status. Bootstraps the first user as a moderator if no mods are stored. |
| GET | `/api/permissions` | Check moderator permissions against stored mod list |
| GET | `/api/queue` | Fetch enriched, priority-scored queue with pattern detection, anomaly analysis, spam ring grouping, and `fromCache` flag |
| GET | `/api/anomalies` | Run anomaly detection independently |
| GET | `/api/patterns` | Run pattern detection independently |
| GET | `/api/workload` | Fetch mod activity statistics (actions by type/mod/time, top flagged users, recent history) |
| GET | `/api/leaderboard` | Fetch mod team leaderboard with time range (`week`, `month`, `all`) |
| GET | `/api/banned` | Fetch active banned users list (expired bans filtered out automatically) |
| GET | `/api/ban-durations` | Fetch available ban duration options (0, 1, 3, 7, 14, 30 days) |
| GET | `/api/community` | Fetch community leaderboard with time range filtering and viewer rank |
| GET | `/api/settings` | Read per-subreddit settings merged with defaults |
| POST | `/api/settings` | Update per-subreddit settings with validation (refresh interval clamped to 10s-300s) |
| POST | `/api/settings/reset` | Reset settings to defaults |
| POST | `/api/action/approve` | Approve content. Rate-limited: 10/min. |
| POST | `/api/action/remove` | Remove content. Rate-limited: 10/min. |
| POST | `/api/action/lock` | Lock content. Rate-limited: 10/min. |
| POST | `/api/action/ban` | Ban user with optional duration and domain storage. Rate-limited: 10/min. |
| POST | `/api/action/unban` | Unban user and remove from banned list. Rate-limited: 10/min. |
| POST | `/api/action/removeAndBan` | Remove and ban in one step with domain storage. Rate-limited: 10/min. |
| POST | `/api/action/bulk` | Execute bulk action on multiple items. Rate-limited: 5 per 5 minutes. |
| POST | `/api/cleanup` | Clear all cached data for the subreddit (17 Redis keys) |

All action endpoints clear the queue cache on success to ensure the next fetch reflects the action.

---

## Project Structure

```
src/
  client/
    components/                  React components
      Dashboard.tsx              Root orchestrator with tabs, stats, settings,
                                 mod/public view switching, keyboard shortcuts
      PriorityQueue.tsx          Grouped spam rings + individual queue rendering
      QueueItem.tsx              Single queue row with priority dot, inline
                                 context, content preview, and action buttons
      DetailModal.tsx            Full item detail overlay with user details grid,
                                 action history, reports, priority factors
      BulkActionBar.tsx          Sticky bottom bar for multi-select operations
                                 with ban duration picker
      PublicDashboard.tsx        Community-facing leaderboard with animated
                                 numbers, rank cards, activity feed, trending posts
      WorkloadTab.tsx            Mod analytics with bar charts, top flagged users,
                                 banned user management with unban
      AlertBanner.tsx            Anomaly alert display with severity coloring
      PatternAlert.tsx           Pattern detection cards (link clusters, time
                                 bursts, username patterns) with dismiss
      ContextCard.tsx            Inline user context pills (age, karma, badges,
                                 action summary)
      ConfirmDialog.tsx          Confirmation modal for destructive actions
      EmptyState.tsx             Shield + checkmark empty state placeholder
      ErrorBoundary.tsx          React class error boundary with error display
                                 and reload button
      LoadingState.tsx           Skeleton loading placeholders
    hooks/                       Custom React hooks
      useQueue.ts                Queue data with auto-refresh (clamped 10s-300s),
                                 10s fetch timeout, 5s slow detection, abort
                                 controller, fromCache awareness
      useWorkload.ts             Workload statistics fetching
      useSettings.ts             Settings read/write with defaults merge and
                                 reset capability
      usePatterns.ts             Pattern detection fetching
    utils/
      time.ts                    Relative timestamp formatting (Xs/Xm/Xh/Xd ago)
    index.css                    Complete design system with 90+ CSS custom
                                 properties, two visual identities (mod dashboard
                                 + community view), responsive breakpoints,
                                 skeleton animations, component styles
    dashboard.html / .tsx        Expanded mod view entry point
    splash.html / .tsx           Inline feed entry point with two variants
                                 (Community Pulse or Mods Only)
  server/
    core/                        Server modules
      queueFetcher.ts            Mod queue fetching and parsing with fallback
                                 to cached snapshot. Handles multiple Reddit API
                                 response formats for author names, timestamps,
                                 report reasons, and content fields.
      contextEnricher.ts         User profile enrichment with batch processing
                                 (15 per batch), Redis caching (1h TTL),
                                 deduplication, action history, queue appearances,
                                 and subreddit posting history
      priorityScorer.ts          Weighted scoring algorithm. Pure function.
                                 No I/O. 8 scoring factors. Score capped at 100.
      patternDetector.ts         Link clusters, time bursts (sliding 1h window),
                                 and username patterns (5 regex types)
      alertSystem.ts             Anomaly detection: report spikes (velocity-
                                 tracked), new account floods, repeat offenders,
                                 ban evasion (domain + username similarity).
                                 2-minute cooldowns. Persisted in Redis.
      leaderboardTracker.ts      Trigger-based activity tracking using Redis
                                 hashes (counts) and sorted sets (timestamps).
                                 Supports time-range filtering, viewer rank,
                                 seeding, and cleanup.
      modActions.ts              Reddit API action execution (approve, remove,
                                 lock, ban, unban, removeAndBan). Banned user
                                 list management with domain storage.
      activityTracker.ts         Workload aggregation (actions by type/mod/hour/day,
                                 coverage gaps, top flagged users). Mod team
                                 leaderboard with caching.
      permissions.ts             Moderator resolution and bootstrap. First user
                                 to open the app is auto-stored as a mod.
                                 Stored mod list persists for 365 days.
      rateLimiter.ts             Redis sliding-window rate limiter. General
                                 (30/min), actions (10/min), bulk (5/5min).
                                 Fails open if Redis is unavailable.
      settings.ts                Per-subreddit settings persistence with defaults
                                 merge, refresh interval validation (10s-300s),
                                 and reset capability
      cache.ts                   Redis cache wrapper with get/set/delete/exists
                                 and TTL support. All operations error-safe.
      constants.ts               Redis key patterns, TTL values, scoring weights,
                                 pattern thresholds, rate limits, ban evasion
                                 parameters, report velocity thresholds
      logger.ts                  Structured JSON logger (info/warn/error)
      post.ts                    Dashboard post creation and existing post search
    routes/                      Route files
      api.ts                     REST endpoints with rate limiting, error handling,
                                 queue cache management, and spam ring grouping
      community.ts               Community leaderboard with two-tier seeding
                                 (Reddit posts primary, mod queue fallback)
      forms.ts                   Devvit form handlers (ban, bulk ban, remove+ban)
      menu.ts                    Subreddit menu action (creates dashboard post)
      triggers.ts                Devvit trigger handlers with robust extraction
                                 helpers for inconsistent Reddit API formats
    index.ts                     Hono server entry point composing all routes
  shared/
    api.ts                       Shared TypeScript type definitions (15 types)
```

---

## Redis Schema

| Key Pattern | Contents | TTL |
|:--|:--|:--|
| `mqcc:queue:{id}` | Cached queue snapshot with timestamp for fromCache detection | 60 seconds |
| `mqcc:u2:{username}` | Enriched user context (age, karma, action history, queue appearances) | 1 hour |
| `mqcc:actions:{id}` | Mod action history, max 500 entries, oldest trimmed | 30 days |
| `mqcc:appear:{username}` | Queue appearance count per user | 7 days |
| `mqcc:settings:{id}` | Per-subreddit app settings | 24 hours |
| `mqcc:workload:{id}` | Workload aggregation cache | 5 minutes |
| `mqcc:alertstate:{id}` | Anomaly cooldown timestamps per type | 24 hours |
| `mqcc:anomalies:{id}` | Persisted anomaly list for cross-refresh visibility | 5 minutes |
| `mqcc:storedmods:{id}` | Cached moderator list | 365 days |
| `mqcc:setup:{id}` | First-visit setup completion flag | 365 days |
| `mqcc:lb:{id}` | Mod team leaderboard data | 30 days |
| `mqcc:lb:posts:{id}` | Community post counts per user (hash) | 30 days |
| `mqcc:lb:comments:{id}` | Community comment counts per user (hash) | 30 days |
| `mqcc:lb:total:{id}` | Community total activity per user (hash) | 30 days |
| `mqcc:lb:recent:{id}` | Recent activity feed entries (sorted set, max 5) | 30 days |
| `mqcc:lb:trending:{id}` | Trending posts (sorted set, max 5) | 30 days |
| `mqcc:lb:allactivity:{id}` | All activity with timestamps for time-range filtering (sorted set, max 10,000) | 30 days |
| `mqcc:lb:seeded:{id}` | Leaderboard seeding completion flag | 30 days |
| `mqcc:banned:{id}` | Banned user records with extracted domains | 30 days |
| `mqcc:ratelimit:{id}` | Rate limit sliding window timestamps | 2x window duration |
| `mqcc:reporthistory:{id}` | Report velocity snapshots for spike detection | 24 hours |
| `mqcc:subposts:{id}:{username}` | Per-user subreddit post count tracked by triggers | 30 days |

---

## Design Decisions and Trade-offs

This section documents the reasoning behind architectural choices that may appear as limitations at first glance. Every decision was made deliberately to balance reliability, performance, and the constraints of the Devvit serverless platform.

### Hardcoded Scoring Thresholds

The scoring factors use fixed point values rather than configurable weights. This was a deliberate choice for three reasons:

1. **Predictability.** Moderators can rely on the queue ordering being consistent across sessions. An item that scored critical yesterday will score critical today with the same inputs.
2. **Testability.** Fixed thresholds enabled writing 32 unit tests that cover every factor, edge case, and severity boundary. The scoring algorithm is a pure function — same input, same output, every time.
3. **Platform constraints.** Devvit's serverless environment has execution time limits. A scoring function that needs to read settings from Redis on every call would add latency and Redis operations to an already complex enrichment pipeline.

The infrastructure for configurable weights exists in the codebase (the scoring function accepts a weights parameter, and the settings system stores and persists them) but is not yet wired into the calculation. This is a planned enhancement.

### 100-Item Queue Limit

The mod queue is capped at 100 items per fetch. This is a pragmatic choice because:

1. Reddit's `getModQueue` API does not support efficient pagination in the Devvit context. Fetching more items increases both API call duration and enrichment time proportionally.
2. The enrichment pipeline fetches user profiles, checks queue appearances, and looks up action history for every item. At 100 items with deduplication, this typically means 30-80 unique user lookups. Beyond 100 items, the risk of hitting serverless execution timeouts increases.
3. For the vast majority of subreddits, the mod queue rarely exceeds 100 items. The priority scoring ensures that the most important items are always in the fetched set and sorted to the top.

### 500-Entry Action History Limit

Mod action history is capped at 500 entries, with the oldest entries trimmed when new ones are added. This bounds Redis storage growth while preserving several months of history for most mod teams. The workload analytics, top flagged users, and recent actions feed all derive from this history.

### Fail-Open Rate Limiting

The rate limiter is designed to fail open: if Redis is unavailable or the rate limit check throws an error, the request is allowed through. This is intentional. A rate limiter that fails closed would lock moderators out of their own tools during Redis outages. The risk of allowing a few extra requests during a brief Redis outage is outweighed by the risk of a moderator being unable to act on a critical spam wave.

### Mod Queue Fallback for Private Subreddit Seeding

The community leaderboard seeding uses a two-tier approach: real subreddit posts first, mod queue as fallback. The mod queue fallback exists specifically for private subreddits where Reddit's `getNewPosts` API returns 403. In this context, the mod queue is the only available data source. While the mod queue contains reported items, reported content is not exclusively rule-breaking — it often includes perfectly valid posts that received a single report. The seed data is temporary and gets overwritten as trigger-based activity data accumulates.

### Defensive Error Handling Over Performance

Every external call (Redis reads, Reddit API calls, enrichment steps) is wrapped in try-catch with specific fallback behavior:

| Operation | On Failure |
|:--|:--|
| Queue fetch | Returns cached Redis snapshot |
| User profile | Returns default context with `-1` sentinels |
| Anomaly detection | Returns empty array |
| Pattern detection | Returns empty result set |
| Settings fetch | Returns hardcoded defaults |
| Rate limit check | Allows the request through |
| Action recording | Logs warning, does not block the action |
| Leaderboard fetch | Returns empty data |

This adds code verbosity but ensures the dashboard is always functional. The guiding principle: a moderator should never see a blank screen because one API call timed out.

### Author Name Normalization

The Reddit API returns author names inconsistently — sometimes as a plain string, sometimes as an object with a `name` field, and sometimes as `[object Object]` when serialization fails. A `toStr`/`safeName` helper function checks multiple formats and is used in every code path that touches author names: the queue fetcher, context enricher, leaderboard tracker, and trigger handlers. This pattern is duplicated rather than shared because each module operates independently and the failure mode of one should not cascade to others.

---

## Known Limitations

| Limitation | Impact | Mitigation |
|:--|:--|:--|
| Max 100 items per queue fetch | Subreddits with 100+ reported items only see the first 100 | Priority scoring ensures the most critical items are included. The queue is sorted by descending score, so moderators act on the worst items first. |
| 500-entry action history cap | Very active mod teams may lose history older than a few months | The most recent 500 actions are always preserved. Workload analytics derive from this window. |
| Hardcoded scoring thresholds | Cannot be tuned per-subreddit | Thresholds were tested against a range of scenarios and are designed to work across subreddit sizes. Configurable weights infrastructure exists for future use. |
| 60-second queue cache TTL | Actions taken outside queuezero may not appear for up to 60 seconds | The "Refresh" button and auto-refresh bypass the cache. The `fromCache` indicator tells moderators when they're seeing stale data. |
| Mod queue fallback seeds reported items | On private subreddits, the initial leaderboard may briefly contain reported content | This is overwritten by real trigger data as activity accumulates. The primary seed (public subreddits) uses actual subreddit posts. |

---

## What I Learned

Building for the Devvit platform meant working with constraints that do not exist in normal web development. There is no persistent filesystem. The client runs inside an iframe without access to `window.alert` or file downloads. The serverless environment can cold-start at any time, so every external call needs defensive error handling.

The hardest lesson was in data handling. The Reddit API returns author names inconsistently — sometimes as a plain string, sometimes as an object with a `name` field. A value that looks like `"username"` on one call might come back as `{name: "username", id: "t2_xxx"}` on the next. A helper function checks both formats and is used in every code path that touches author names. It was not elegant, but it solved the problem permanently.

The second lesson was to prioritize reliability over performance. Every Redis read, every API call, every enrichment step is wrapped in error handling with fallback behavior. If the queue fetch fails, the cached snapshot is returned. If a user profile is unavailable, default values are used. If anomaly detection throws, an empty array comes back. The dashboard stays functional even when individual pieces fail. A moderator should never see a blank screen because one API call timed out.

The third lesson was that the Devvit trigger system is the key to building features that would otherwise be impossible on the platform. The community leaderboard works on private subreddits not because of clever API workarounds, but because triggers bypass the visibility restrictions entirely. Triggers fire at the moment activity happens, which means the leaderboard is always current without polling.

---

## Challenges

**Private subreddit leaderboard.** Reddit's listing endpoints return 403 on private communities. The solution was to stop querying altogether and rely entirely on Devvit's trigger system. Every post and comment is recorded the moment it is created, and deletions are handled the same way. The leaderboard builds itself over time without ever needing to read a listing.

**Seed-on-first-visit.** When a moderator opens the Community View for the first time, the leaderboard is empty. The primary solution fetches the subreddit's recent posts via `getNewPosts`. For private subreddits where that API returns nothing, a fallback seeds from the mod queue data. A Redis flag ensures seeding only happens once. After that, all data comes exclusively from triggers.

**Design system inside an iframe.** Three distinct visual identities — the mod dashboard in dark tones for dense information display, the community view in a purple palette designed for engagement, and the splash screen for feed visibility — all sharing the same CSS custom property foundation without fighting Reddit's own iframe styles. Approximately 90 custom properties define the entire design system.

**Ban evasion that means something.** The first version just flagged accounts that had been actioned before, which was nearly useless. The real version stores the domains from banned users' content and cross-references them against new queue items. It also runs string similarity checks on usernames. Neither signal alone is proof, but combined they surface the accounts a moderator should actually investigate. The 72-hour timing window and minimum 2-suspect threshold reduce false positives from coincidental matches.

**Inconsistent Reddit API responses.** Author names, timestamps, report reasons, and content fields all have multiple possible formats depending on the API endpoint and the type of content. The queue fetcher handles plain strings, nested objects, Unix timestamps (both seconds and milliseconds), ISO date strings, and Date objects. The `toStr` helper pattern is duplicated across modules to ensure that a failure in one module's parsing doesn't cascade to others.

---

## Testing

```bash
npm run test              # Run test suite
npm run type-check        # TypeScript type checking
npm run lint              # ESLint across all source files
```

### Test Coverage

| Suite | Cases | What It Covers |
|:--|:--|:--|
| `priorityScorer.test.ts` | 32 | Every scoring factor: report count scaling, all account age tiers, all karma tiers, queue appearance tiers, mod action tiers, shadowbanned and suspended bonuses (stackable), spam keyword detection with deduplication and multi-keyword handling, score cap at 100, all four severity level thresholds, unknown sentinel value handling, factor array limit (max 5), post vs comment parity |
| `patternDetector.test.ts` | 24 | Link cluster detection from body/url/title fields, www prefix stripping, domain deduplication within items, multi-cluster detection, single-author exclusion. Time burst detection with 3-item minimum, new account threshold, 1-hour window boundary. Username patterns (name+numbers, auto_ prefix, bot_ prefix, repeated characters, name_name) with case insensitivity and 3-account minimum. Combined multi-pattern detection and false positive resistance with diverse normal usernames. |

All 56 tests pass. Both test files mock `@devvit/web/server` (Redis, Reddit API, context) to test logic in isolation.

---

## Getting Started

### Prerequisites

- Node.js 22+
- Devvit CLI (`npm install -g @devvit/cli`)
- Reddit account with moderator permissions

### Development

```bash
git clone https://github.com/arubara2021/Reddit_MQCC
cd Reddit_MQCC
npm install
npm run login
npm run dev
```

### Deploy

```bash
npm run deploy    # type-check + lint + upload to Devvit
npm run launch    # deploy + publish to App Directory
```

### Commands

| Command | Action |
|:--|:--|
| `npm run dev` | Start playtest with hot reload |
| `npm run build` | Build client and server bundles via Vite |
| `npm run type-check` | Run TypeScript type checking (project references) |
| `npm run lint` | Run ESLint across all source files |
| `npm run test` | Run full test suite via Vitest |
| `npm run deploy` | Type-check, lint, upload to Devvit |
| `npm run launch` | Deploy and publish to App Directory |
| `npm run prettier` | Format code with Prettier |

---

## What Comes Next

- **Historical trend tracking** — So moderators can see whether their community's health is improving or declining over time
- **Saved filter presets** — For switching between views instantly without re-configuring filters each session
- **Configurable scoring weights** — Allow moderators to tune priority weights through the settings UI. The infrastructure (function parameter, settings persistence) is already in place; the remaining work is wiring the weights into the scoring calculation.
- **Additional anomaly types** — Based on real moderator feedback and patterns encountered in active communities
- **Deeper ban evasion detection** — Using behavioral analysis beyond domains and usernames

Successful apps built on Devvit are eligible for the Reddit Developer Funds program. queuezero is built to grow with every community that adopts it.

---

## License

MIT

---

<div align="center">

**[Install QueueZero](https://developers.reddit.com/apps/queuezero)** | **[Watch Demo](https://youtu.be/7FU9GlGYx6Q)** | **[Report Issues](https://github.com/arubara2021/Reddit_MQCC/issues)**

Built with [Devvit](https://developers.reddit.com/) for the Reddit Mod Tools Hackathon.

</div>
