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

Every reported item is scored from 0 to 100 using a weighted algorithm. The score is based on seven factors: how many reports the item has, how old the author's account is, their karma, how many times they have appeared in the queue before, whether they have been actioned by moderators previously, their account status (shadowbanned, suspended), and whether spam keywords appear in the report reasons. Critical items score 80 or above and sit at the top of the queue, glowing red. A single report against a longtime community member with thousands of karma scores a 6 and sinks to the bottom. The queue finally tells you where to start.

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
| **Settings** | Auto-refresh with configurable intervals, compact mode, priority weight tuning, spam ring grouping toggle, anomaly alerts toggle, community leaderboard visibility, and full data reset. All settings persist per-subreddit in Redis. |
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
| **Ban** | Ban the author with configurable duration (permanent, 3 days, 7 days, etc.) |
| **Unban** | Remove a ban |
| **Remove and Ban** | Remove the content and ban the author in a single action |
| **Bulk** | Execute any of the above on multiple selected items at once |

All actions are rate-limited to prevent accidental mass operations. A confirmation dialog appears before any ban or bulk action. The queue refreshes automatically after actions to reflect changes.

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

**Server-side enrichment.** User profiles are fetched and cached on the server in batches of 3, not on the client. This avoids dozens of individual profile requests from the browser and keeps all Reddit API interactions inside the authenticated serverless environment. The client receives fully enriched data in a single API call.

**Pure scoring function.** The priority scoring algorithm takes a raw queue item and a user context object and returns a score between 0 and 100 with a severity level and a list of contributing factors. It performs no I/O, makes no API calls, and produces the same output for the same input.

**Trigger-based leaderboard.** The community leaderboard uses Devvit's `onPostSubmit`, `onCommentSubmit`, `onPostDelete`, and `onCommentDelete` triggers instead of Reddit's listing APIs. This works identically on both public and private subreddits.

**Defensive error handling.** Every Redis read, every API call, every enrichment step is wrapped in try-catch with fallback behavior. If the queue fetch fails, the cached snapshot is returned. If a user profile is unavailable, default values with `-1` sentinels are used. If anomaly detection throws, an empty array is returned.

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
| Report count | 40 | (reportCount / 5) * 40, capped at 40 |
| Account age | 25 | < 1 day = 25, < 7 days = 20, < 30 days = 10, 30+ = 0 |
| Karma | 20 | 0 karma = 20, < 10 = 15, < 50 = 5, 50+ = 0 |
| Queue history | 15 | 5+ appearances = 15, 3-4 = 10, 2 = 5 |
| Prior mod actions | 10 | 3+ actions = 10, 1-2 = 5 |
| Shadowbanned | +15 | Flat bonus |
| Suspended | +15 | Flat bonus |

### Spam Keywords

Report reasons are scanned for `spam`, `scam`, `bot`, `phishing`, `fake`, and `fraud`. Each unique keyword found across all report reasons adds 10 points, once per keyword. Each report reason contributes at most one keyword hit to prevent double-counting.

### Scoring Examples

| Scenario | Score | Level |
|:--|:--|:--|
| 2-year-old account, 5000 karma, 1 report | 6 | low |
| 10-day-old account, 30 karma, 2 reports | 27 | low |
| 5-day-old account, 2 karma, 3 reports, "spam" in reason | 53 | medium |
| 1-day-old account, 0 karma, 5 reports, "spam bot" in reason | 95 | critical |
| Shadowbanned account, 0 karma, 3 reports | 83 | critical |

Unknown values (sentinel `-1`) are excluded from scoring. Final score capped at 100.

---

## Pattern Detection

| Pattern | Method | Threshold |
|:--|:--|:--|
| **Link clusters** | Extracts domains from body, url, and title fields using regex | 2+ authors sharing the same domain |
| **Time bursts** | 1-hour sliding window over post timestamps | 3+ items with 2+ from new accounts (< 7 days old) |
| **Username patterns** | Regex matching against 5 pattern types | 3+ accounts matching the same pattern |

### Username Patterns Detected

| Pattern | Example |
|:--|:--|
| name + numbers | `john_1234`, `user5678` |
| name_name | `auto_poster`, `test_account` |
| `auto_` prefix | `auto_submit`, `auto_share` |
| `bot_` prefix | `bot_user1`, `bot_poster` |
| Repeated characters | `aaaa`, `spamspam` |

Groups appear inline in the queue with clear labels, affected author lists, and their own priority score based on the highest-scoring item in the group.

---

## Ban Evasion Detection

Cross-references queue items against recently banned users using two methods:

| Method | How It Works |
|:--|:--|
| **Domain matching** | Stores domains extracted from every banned user's content. New queue items are scanned for the same domains. A brand new account posting the same domain a banned user was sharing gets flagged. |
| **Username similarity** | Compares new queue item authors against recently banned usernames using string similarity and prefix matching. Accounts with names like `john_doe_2` matching a banned `john_doe` get flagged. |

Neither signal alone is proof of evasion. Combined, they surface accounts worth investigating. Domains from banned content are stored automatically whenever a Remove and Ban action is executed.

---

## Anomaly Detection

| Anomaly | Condition | Severity |
|:--|:--|:--|
| **Report spike** | > 15 reports from 3+ unique authors, tracked by velocity against historical average | High (> 30 = Critical) |
| **New account flood** | 3+ queue items from accounts < 7 days old | High (5+ = Critical) |
| **Repeat offenders** | 2+ users with 3+ queue appearances | Medium |
| **Ban evasion** | New accounts matching banned user domains or usernames | Critical |

Each anomaly type has a 2-minute cooldown to prevent alert fatigue. Anomaly state persists across page refreshes via Redis.

---

## Data Flow

### Mod Queue Enrichment

```
1. Moderator opens the Dashboard
2. Client requests GET /api/queue
3. Server fetches mod queue from Reddit API
4. Raw items parsed and cached in Redis (60s TTL)
5. User profiles fetched in batches of 3 (rate-limit aware)
6. Context enriched with action history, queue appearances,
   and subreddit posting history
7. Priority score computed for each item (pure function)
8. Pattern detection, ban evasion check, and anomaly analysis run
9. Fully enriched items returned, sorted by descending score
```

### Community Leaderboard

```
1. User creates a post or comment
2. Devvit trigger fires (onPostSubmit / onCommentSubmit)
3. Leaderboard tracker records activity in Redis
4. User deletes a post or comment
5. Devvit trigger fires (onPostDelete / onCommentDelete)
6. Leaderboard tracker decrements counts
7. Community View loads leaderboard directly from Redis
```

Trigger-based tracking works identically on public and private subreddits because it captures activity at the moment it happens.

### Seed-on-First-Visit

When a moderator first opens the Community View, the leaderboard is empty because no triggers have fired yet. The system fetches the mod queue on the first visit, uses it to populate the leaderboard, and sets a Redis flag so this only happens once. After seeding, all data comes exclusively from triggers.

---

## API Endpoints

| Method | Path | Purpose |
|:--|:--|:--|
| GET | `/api/init` | Resolve user identity and mod status |
| GET | `/api/permissions` | Check and bootstrap moderator permissions |
| GET | `/api/queue` | Fetch enriched, priority-scored queue with `fromCache` flag |
| GET | `/api/anomalies` | Run anomaly detection |
| GET | `/api/patterns` | Run pattern detection |
| GET | `/api/workload` | Fetch mod activity statistics |
| GET | `/api/leaderboard` | Fetch mod team leaderboard |
| GET | `/api/banned` | Fetch banned users list |
| GET | `/api/ban-durations` | Fetch available ban duration options |
| GET | `/api/community` | Fetch community leaderboard with time range filtering |
| GET | `/api/settings` | Read subreddit settings |
| POST | `/api/settings` | Update subreddit settings |
| POST | `/api/settings/reset` | Reset settings to defaults |
| POST | `/api/action/approve` | Approve content |
| POST | `/api/action/remove` | Remove content |
| POST | `/api/action/lock` | Lock content |
| POST | `/api/action/ban` | Ban user with optional duration and domain storage |
| POST | `/api/action/unban` | Unban user |
| POST | `/api/action/removeAndBan` | Remove and ban in one step with domain storage |
| POST | `/api/action/bulk` | Execute bulk action on multiple items |
| POST | `/api/cleanup` | Clear all cached data for the subreddit |

---

## Project Structure

```
src/
  client/
    components/                  React components
      Dashboard.tsx              Root orchestrator with tabs, stats, settings
      PriorityQueue.tsx          Grouped + individual queue rendering
      QueueItem.tsx              Single queue row with inline context and actions
      DetailModal.tsx            Full item detail with action history
      BulkActionBar.tsx          Sticky bottom bar for bulk operations
      PublicDashboard.tsx        Community-facing leaderboard with time filtering
      WorkloadTab.tsx            Mod analytics + banned users management
      AlertBanner.tsx            Anomaly alert display
      PatternAlert.tsx           Pattern detection cards
      ContextCard.tsx            Inline user context (age, karma, history)
      ConfirmDialog.tsx          Confirmation modal for destructive actions
      EmptyState.tsx             Empty state placeholder
      ErrorBoundary.tsx          React error boundary
    hooks/                       Custom React hooks
      useQueue.ts                Queue data with auto-refresh, timeout, fromCache
      useWorkload.ts             Workload statistics
      useSettings.ts             Settings read/write with persistence
      usePatterns.ts             Pattern detection
    utils/
      time.ts                    Relative timestamp formatting
    index.css                    Design system (90+ CSS custom properties)
    dashboard.html / .tsx        Expanded mod view entry point
    splash.html / .tsx           Inline feed entry point
  server/
    core/                        Server modules
      queueFetcher.ts            Mod queue fetching and parsing
      contextEnricher.ts         User profile enrichment with action history
      priorityScorer.ts          Weighted scoring algorithm (pure function)
      patternDetector.ts         Link clusters, time bursts, username patterns
      alertSystem.ts             Anomaly detection with ban evasion cross-reference
      leaderboardTracker.ts      Trigger-based activity tracking with time filtering
      modActions.ts              Reddit API action execution with domain storage
      activityTracker.ts         Workload aggregation and leaderboard
      permissions.ts             Mod resolution and bootstrap
      rateLimiter.ts             Sliding-window rate limiter
      settings.ts                Per-subreddit configuration persistence
      cache.ts                   Redis cache wrapper with TTL support
      constants.ts               Key patterns and TTL values
      logger.ts                  Structured JSON logger
      post.ts                    Dashboard post management
    routes/                      Route files
      api.ts                     REST API endpoints with fromCache detection
      community.ts               Community leaderboard with time range filtering
      forms.ts                   Form submission handlers
      menu.ts                    Subreddit menu action
      triggers.ts                Devvit trigger handlers (post/comment lifecycle)
    index.ts                     Hono server entry point
  shared/
    api.ts                       Shared TypeScript type definitions
```

---

## Redis Schema

| Key Pattern | Contents | TTL |
|:--|:--|:--|
| `mqcc:queue:{id}` | Cached queue snapshot with timestamp comparison | 60s |
| `mqcc:u2:{username}` | Enriched user context (age, karma, action history) | 1 hour |
| `mqcc:actions:{id}` | Mod action history (max 500 entries) | 30 days |
| `mqcc:appear:{username}` | Queue appearance count per user | 7 days |
| `mqcc:settings:{id}` | Per-subreddit app settings | 24 hours |
| `mqcc:workload:{id}` | Workload aggregation data | 5 minutes |
| `mqcc:alertstate:{id}` | Anomaly cooldown state | 24 hours |
| `mqcc:anomalies:{id}` | Persisted anomaly list | 5 minutes |
| `mqcc:storedmods:{id}` | Cached moderator list | 365 days |
| `mqcc:lb:{id}` | Community leaderboard data | 30 days |
| `mqcc:lb:allactivity:{id}` | Timestamped activity entries for time-range filtering | 30 days |
| `mqcc:banned:{id}` | Banned user records with extracted domains | 30 days |
| `mqcc:ratelimit:{id}` | Rate limit sliding window timestamps | 2x window |

---

## What I Learned

Building for the Devvit platform meant working with constraints that do not exist in normal web development. There is no persistent filesystem. The client runs inside an iframe without access to `window.alert` or file downloads. The serverless environment can cold-start at any time, so every external call needs defensive error handling.

The hardest lesson was in data handling. The Reddit API returns author names inconsistently — sometimes as a plain string, sometimes as an object with a `name` field. A value that looks like `"username"` on one call might come back as `{name: "username", id: "t2_xxx"}` on the next. A helper function checks both formats and is used in every code path that touches author names. It was not elegant, but it solved the problem permanently.

The second lesson was to prioritize reliability over performance. Every Redis read, every API call, every enrichment step is wrapped in error handling with fallback behavior. If the queue fetch fails, the cached snapshot is returned. If a user profile is unavailable, default values are used. If anomaly detection throws, an empty array comes back. The dashboard stays functional even when individual pieces fail. A moderator should never see a blank screen because one API call timed out.

---

## Challenges

**Private subreddit leaderboard.** Reddit's listing endpoints return 403 on private communities. The solution was to stop querying altogether and rely entirely on Devvit's trigger system. Every post and comment is recorded the moment it is created, and deletions are handled the same way. The leaderboard builds itself over time without ever needing to read a listing.

**Seed-on-first-visit.** When a moderator opens the Community View for the first time, the leaderboard is empty. The solution was to fetch the mod queue on first visit, use it as the initial data source, and set a Redis flag so it only happens once. After that, all data comes exclusively from triggers.

**Design system inside an iframe.** Three distinct visual identities — the mod dashboard in zinc-tinted dark tones for dense information display, the community view in a purple palette designed for engagement, and the splash screen in blue for feed visibility — all sharing the same CSS custom property foundation without fighting Reddit's own styles.

**Ban evasion that means something.** The first version just flagged accounts that had been actioned before, which was nearly useless. The real version stores the domains from banned users' content and cross-references them against new queue items. It also runs string similarity checks on usernames. Neither signal alone is proof, but combined they surface the accounts a moderator should actually investigate.

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
| `priorityScorer.test.ts` | 32 | Every scoring factor: report count, account age, karma, queue history, mod actions, shadowbanned, suspended, spam keywords with deduplication, score caps, all severity level thresholds, unknown sentinel values, edge cases |
| `patternDetector.test.ts` | 24 | Link clusters from body/url/title fields, www prefix stripping, domain deduplication, time burst detection with new account threshold, username patterns (name+numbers, auto_ prefix, bot_ prefix, repeated characters, name_name), combined multi-pattern detection, false positive resistance |

All 56 tests pass. The priority scoring algorithm is a pure function — same input, same output, every time — which made comprehensive testing straightforward.

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
| `npm run build` | Build client and server bundles |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run full test suite |
| `npm run deploy` | Type-check, lint, upload to Devvit |
| `npm run launch` | Deploy and publish to App Directory |

---

## What Comes Next

- **Historical trend tracking** — So moderators can see whether their community's health is improving or declining over time
- **Saved filter presets** — For switching between views instantly without re-configuring filters each session
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
