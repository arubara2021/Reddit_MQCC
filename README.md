
<div align="center">

# MQCC

### Mod Queue Command Center

A real-time moderation dashboard for Reddit built on the Devvit platform.

[![Platform](https://img.shields.io/badge/Platform-Devvit-FF4500?style=flat-square&logo=reddit&logoColor=white)](https://developers.reddit.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

Replaces the flat mod queue with a priority-scored, context-enriched interface that detects coordinated spam patterns, surfaces anomaly alerts, exposes bulk action workflows, and provides a community-facing leaderboard.

**[Install from App Directory](https://developers.reddit.com/apps/queuezero)** | **[Watch Demo](https://youtu.be/7FU9GlGYx6Q)**

</div>

---

## The Problem

Reddit's native mod queue presents reported items as an unsorted flat list. Moderators processing hundreds of items per week face five structural gaps:

| Gap | Impact |
|:--|:--|
| No severity ranking | A 15-report post looks the same as a single-report item |
| No inline user context | Every item evaluated in isolation without account history |
| No pattern awareness | Coordinated spam requires manual identification |
| No bulk operations | Cleaning 20 spam posts means 20 individual action cycles |
| No community transparency | Non-mod members have no visibility into community activity |

MQCC resolves all five in a single Devvit installation.

---

## Demo

<div align="center">

[![MQCC Demo Video](https://img.shields.io/badge/WATCH_DEMO-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/Avb5u035dDo)

</div>

---

## Features

### Mod Dashboard

| Feature | Description |
|:--|:--|
| **Priority Scoring** | 7-factor algorithm scores every item 0 to 100. Critical items surface first. |
| **User Context** | Account age, karma, prior actions, and queue history visible on every row. |
| **Pattern Detection** | Identifies link clusters, time bursts, and coordinated username patterns automatically. |
| **Anomaly Alerts** | Detects report spikes, new account floods, repeat offenders, and ban evasion. |
| **Bulk Actions** | Select multiple items. Approve, remove, or ban in one step. |
| **Ban Management** | View all banned users with duration, reason, and one-click unban. |
| **Workload Analytics** | Mod team activity breakdown with charts, flagged users, and recent action feed. |
| **Keyboard Shortcuts** | `r` refresh, `a` approve, `x` remove, `Esc` dismiss. |

### Community View

| Feature | Description |
|:--|:--|
| **Leaderboard** | Top contributors, most active commenters, and karma rankings. |
| **Viewer Rank** | Every member sees their own position highlighted. |
| **Trending Posts** | Recent posts with author and timestamp. |
| **Activity Feed** | Last 5 community actions in real time. |
| **Private Sub Support** | Works on both public and private subreddits via trigger-based tracking. |

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
|  /internal/*        contextEnricher alertSystem       |
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

---

## Priority Scoring

Every reported item passes through a 7-factor weighted algorithm:

```
Score: 0 -----> 25 -----> 50 -----> 75 -----> 100
       |        |          |         |         |
       low      medium     high      critical
      (gray)   (yellow)  (orange)    (red)
```

| Factor | Max Points | Logic |
|:--|:--|:--|
| Report count | 25 | 8 points per report, capped at 25 |
| Account age | 25 | < 1 day = 25, < 7 days = 20, < 30 days = 10 |
| Karma | 20 | 0 karma = 20, < 10 = 15, < 50 = 5 |
| Queue history | 15 | 5+ appearances = 15, 3+ = 10, 2 = 5 |
| Prior mod actions | 10 | 3+ actions = 10, 1+ = 5 |
| Shadowbanned | +15 | Flat bonus |
| Suspended | +15 | Flat bonus |

Spam keywords in report reasons add 10 points each. Final score capped at 100.

---

## Pattern Detection

| Pattern | Method | Threshold |
|:--|:--|:--|
| **Link clusters** | Extracts domains from body/url/title fields | 2+ authors sharing the same domain |
| **Time bursts** | 1-hour sliding window over post timestamps | 3+ items with 2+ from new accounts (< 7 days) |
| **Username patterns** | Regex matching against 5 pattern types | 3+ accounts matching the same pattern |

Username patterns detected: `name+numbers`, `name_name`, `auto_` prefix, `bot_` prefix, repeated characters.

---

## Anomaly Detection

| Anomaly | Condition | Severity |
|:--|:--|:--|
| Report spike | > 15 reports from 3+ unique authors | High (> 30 = Critical) |
| New account flood | 3+ queue items from accounts < 7 days old | High (5+ = Critical) |
| Repeat offenders | 2+ users with 3+ queue appearances | Medium |
| Ban evasion | 2+ previously actioned users with accounts < 30 days | Critical |

Each anomaly type has a 2-minute cooldown to prevent alert fatigue. State persists across page refreshes via Redis.

---

## Data Flow

### Mod Queue Enrichment

```
1. Mod opens Dashboard
2. Client requests GET /api/queue
3. Server fetches mod queue from Reddit API
4. Raw items parsed and cached in Redis (60s TTL)
5. User profiles fetched in batches of 3 (rate-limit aware)
6. Context enriched with mod action history and queue appearances
7. Priority score computed for each item (pure function)
8. Pattern detection and anomaly analysis run
9. Fully enriched items returned, sorted by descending score
```

### Community Leaderboard

```
1. User creates a post/comment
2. Devvit trigger fires (onPostSubmit/onCommentSubmit)
3. Leaderboard tracker records activity in Redis
4. User deletes a post
5. Devvit trigger fires (onPostDelete/onCommentDelete)
6. Leaderboard tracker decrements counts
7. Community View loads leaderboard directly from Redis
```

Trigger-based tracking works identically on public and private subreddits because it captures activity at the moment it happens.

---

## API Endpoints

| Method | Path | Purpose |
|:--|:--|:--|
| GET | `/api/init` | Resolve user identity and mod status |
| GET | `/api/queue` | Fetch enriched, priority-scored queue |
| GET | `/api/anomalies` | Run anomaly detection |
| GET | `/api/patterns` | Run pattern detection |
| GET | `/api/workload` | Fetch mod activity statistics |
| GET | `/api/banned` | Fetch banned users list |
| GET | `/api/community` | Fetch community leaderboard |
| GET | `/api/settings` | Read subreddit settings |
| POST | `/api/settings` | Update subreddit settings |
| POST | `/api/action/approve` | Approve content |
| POST | `/api/action/remove` | Remove content |
| POST | `/api/action/lock` | Lock content |
| POST | `/api/action/ban` | Ban user |
| POST | `/api/action/unban` | Unban user |
| POST | `/api/action/removeAndBan` | Remove and ban |
| POST | `/api/action/bulk` | Execute bulk action |
| POST | `/api/cleanup` | Clear all cached data |

---

## Project Structure

```
src/
  client/
    components/                  14 React components
      Dashboard.tsx              Root orchestrator
      PriorityQueue.tsx          Grouped + individual queue rendering
      QueueItem.tsx              Single queue row with actions
      DetailModal.tsx            Full item detail overlay
      BulkActionBar.tsx          Sticky bulk action bar
      PublicDashboard.tsx        Community-facing leaderboard
      WorkloadTab.tsx            Mod analytics + banned users
      AlertBanner.tsx            Anomaly alert display
      PatternAlert.tsx           Pattern detection cards
      ContextCard.tsx            Inline user context
      ConfirmDialog.tsx          Confirmation modal
      EmptyState.tsx             Empty state placeholder
      LoadingState.tsx           Skeleton loading
      ErrorBoundary.tsx          React error boundary
    hooks/                       4 custom hooks
      useQueue.ts                Queue data with auto-refresh and timeout
      useWorkload.ts             Workload statistics
      useSettings.ts             Settings read/write
      usePatterns.ts             Pattern detection
    utils/
      time.ts                    Relative timestamp formatting
    index.css                    Full design system (90+ CSS variables)
    dashboard.html / .tsx        Expanded view entry point
    splash.html / .tsx           Inline feed entry point
  server/
    core/                        15 server modules
      queueFetcher.ts            Mod queue fetching and parsing
      contextEnricher.ts         User profile enrichment
      priorityScorer.ts          7-factor scoring algorithm
      patternDetector.ts         Link/burst/username detection
      alertSystem.ts             Anomaly detection with cooldown
      leaderboardTracker.ts      Trigger-based activity tracking
      modActions.ts              Reddit API action execution
      activityTracker.ts         Workload aggregation
      permissions.ts             Mod resolution and bootstrap
      rateLimiter.ts             Sliding-window rate limiter
      settings.ts                Per-subreddit configuration
      cache.ts                   Redis cache wrapper
      constants.ts               Key patterns and TTL values
      logger.ts                  Structured JSON logger
      post.ts                    Dashboard post management
    routes/                      5 route files
      api.ts                     REST API endpoints
      community.ts               Community leaderboard route
      forms.ts                   Form submission handlers
      menu.ts                    Subreddit menu action
      triggers.ts                Devvit trigger handlers
    index.ts                     Hono server entry point
  shared/
    api.ts                       Shared TypeScript type definitions
```

---

## Redis Schema

| Key Pattern | Contents | TTL |
|:--|:--|:--|
| `mqcc:queue:{id}` | Cached queue snapshot | 60s |
| `mqcc:u2:{username}` | Enriched user context | 1 hour |
| `mqcc:actions:{id}` | Mod action history (max 500) | 30 days |
| `mqcc:appear:{username}` | Queue appearance count | 7 days |
| `mqcc:settings:{id}` | App settings | 24 hours |
| `mqcc:workload:{id}` | Workload aggregation | 5 minutes |
| `mqcc:alertstate:{id}` | Anomaly cooldown state | 24 hours |
| `mqcc:anomalies:{id}` | Persisted anomalies | 5 minutes |
| `mqcc:storedmods:{id}` | Moderator list | 365 days |
| `mqcc:lb:{id}` | Community leaderboard | 30 days |
| `mqcc:banned:{id}` | Banned user records | 30 days |
| `mqcc:ratelimit:{id}` | Rate limit timestamps | 2x window |

---

## Testing

```bash
npm run test
```

| Suite | Cases | Coverage |
|:--|:--|:--|
| `priorityScorer.test.ts` | 28 | All 7 factors, keywords, caps, severity levels |
| `patternDetector.test.ts` | 15 | Link clusters, time bursts, username patterns, combined scenarios |

```bash
npm run type-check    # TypeScript type checking
npm run lint          # ESLint across all source files
```

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
| `npm run test` | Run test suite |
| `npm run deploy` | Type-check, lint, upload |
| `npm run launch` | Deploy and publish |

---

## Design System

| Token | Value | Usage |
|:--|:--|:--|
| Background | `#000000` | Base surface |
| Accent | `#8b5cf6` | Primary actions and highlights |
| Critical | `#f43f5e` | Critical severity indicators |
| High | `#f59e0b` | High severity indicators |
| Success | `#10b981` | Approve and success states |
| Font Display | Space Grotesk | Headings and labels |
| Font Body | Inter | Body text |
| Font Mono | JetBrains Mono | Data, scores, and timestamps |

40+ CSS custom properties for colors, spacing, radius, shadows, and typography.

---

## License

MIT

---

<div align="center">

**[Install MQCC](https://developers.reddit.com/apps/queuezero)** | **[Watch Demo](https://youtu.be/Avb5u035dDo)** | **[Report Issues](https://github.com/arubara2021/Reddit_MQCC/issues)**

Built with [Devvit](https://developers.reddit.com/) for the Reddit Mod Tools Hackathon.

</div>
