
# MQCC — Mod Queue Command Center

A real-time moderation dashboard for Reddit, built on Devvit. MQCC gives subreddit moderators a single interface to triage, prioritize, and act on reported content — without switching between tabs, guessing severity, or losing track of repeat offenders.

---

## The Problem

Moderating a subreddit is a thankless, invisible job. When a post gets reported, it lands in a flat list with dozens of other items. Every item looks the same. There is no urgency signal, no context about the user who posted it, and no way to know if this is the first time someone has been reported or the twentieth.

Here is what a typical mod deals with on any given afternoon:

- **The mod queue is a flat list.** A spam bot with 15 reports sits next to a first-time user who made an honest mistake. There is no sorting by severity, no grouping by pattern, no visual hierarchy. The mod has to click into each item individually to understand what is going on.

- **There is no user context.** When a mod sees a reported post, they do not know if that user has been reported before, how old the account is, how much karma they have, or what actions have already been taken against them. Every decision is made in a vacuum.

- **Repeat offenders fly under the radar.** A user can get reported five times across five different posts over three days, and no system flags the pattern. The mod has to remember names, which nobody does when you are processing hundreds of items a week.

- **Bulk actions are painful.** If a coordinated spam ring hits a subreddit with twenty posts, the mod has to approve or remove each one individually. There is no "select all and ban" flow. It takes fifteen minutes to clean up what should take thirty seconds.

- **No visibility for the community.** Community members have no idea how active the mod team is, what kind of work is happening behind the scenes, or how the subreddit is being managed. This breeds distrust, especially in larger communities.

MQCC was built to solve all of these problems in a single installable app.

---

## What MQCC Does

MQCC is a full moderation dashboard that lives inside Reddit. When a mod opens the app, they see a prioritized queue of reported items, enriched with user context, pattern detection, and anomaly alerts. Everything is actionable from one screen.

### Priority Queue

Every reported item is scored on a priority scale from 0 to 100. The score is calculated from multiple factors:

- **Report count** — More reports means higher priority. Weighted by the ratio against the median report count in the current queue.
- **Account age** — Newer accounts get flagged higher. An account that is 2 days old posting a link with 5 reports is more suspicious than a 10-year-old account with the same reports.
- **Karma** — Low karma accounts with high reports are scored higher. This catches bots and throwaway accounts.
- **Queue history** — Users who have appeared in the queue multiple times before get a priority bump. This is the "repeat offender" signal that Reddit's native queue does not provide.
- **Mod action history** — If a user has already been warned or actioned by a mod and they are back in the queue, that gets scored higher. Previous actions are tracked in Redis.

Items are sorted by priority score, with the most urgent at the top. The score is visible as a number and as a color-coded severity level: critical (red), high (orange), medium (yellow), and low (gray).

### User Context Enrichment

When a reported item loads, MQCC fetches the author's Reddit profile and enriches the item with:

- Account age in days
- Total, post, and comment karma
- Number of times this user has appeared in the queue
- Number of previous mod actions taken against this user
- The type and timestamp of the last action

This context appears inline on every queue item and in a detailed modal when the mod clicks through. The mod can make an informed decision without opening a single new tab.

### Pattern Detection

MQCC analyzes the current queue for patterns that suggest coordinated or automated behavior:

- **Link clusters** — Multiple users posting links to the same domain. This catches spam rings that use shared landing pages.
- **Time bursts** — A spike of reported items within a short time window. This catches bot waves and raid events.
- **Username patterns** — Similar usernames appearing together. This catches account farms that use naming conventions like `user_01`, `user_02`, `user_03`.

When patterns are detected, they appear as alerts at the top of the queue tab. The mod can expand the pattern card to see all affected items and take bulk action.

### Anomaly Alerts

The anomaly detection system runs continuously and flags unusual activity:

- A sudden spike in reports above the rolling average
- A user appearing in the queue an unusual number of times
- A domain being posted by multiple new accounts
- Report volume exceeding a configurable threshold

Alerts are displayed as cards with severity badges. Each alert includes the affected usernames so the mod can investigate directly.

### Bulk Actions

Every queue item has a checkbox. The mod can select individual items or select all, then take a bulk action:

- Approve all selected items
- Remove all selected items
- Ban all selected users
- Remove and ban in one step

Ban duration is configurable: permanent, 1 day, 3 days, 7 days, 14 days, or 30 days. The bulk action bar appears at the bottom of the screen when items are selected and shows the count, ban duration selector, and action buttons.

### Workload Tab

The workload tab gives the mod team visibility into their own activity:

- Total actions broken down by type (approve, remove, ban, lock)
- Per-mod activity breakdown with horizontal bar charts
- Top flagged users ranked by action count
- Recent action feed showing the last 15 actions taken

This helps mod teams coordinate, identify coverage gaps, and track their own output.

### Public Dashboard

Non-mod users see a completely different view: a public community dashboard that shows:

- Community health status
- Leaderboard of contributors ranked by activity score
- Recent mod activity feed (anonymized actions, no queue details)
- Activity time range selector (week, month, all time)

The public dashboard uses a distinct purple theme and is designed to build trust between the mod team and the community. Members can see that the subreddit is actively moderated without seeing sensitive queue data.

### Settings

The settings tab lets the mod configure:

- Auto-refresh toggle and interval (10s, 30s, 1m, 2m, 5m)
- Compact mode for denser queue display
- Group spam rings toggle
- Anomaly alert toggle

---

## Architecture

MQCC is built as a Devvit app with a clear separation between server-side logic and client-side rendering.

### Server

The server runs on Devvit's infrastructure and handles all Reddit API interactions. It is built with:

- **Hono** — Lightweight HTTP framework for route handling
- **Devvit Web Server SDK** — Direct access to Reddit APIs (`reddit.getModQueue`, `reddit.approve`, `reddit.remove`, `reddit.banUser`, etc.)
- **Redis** — Persistent storage for mod action history, user context cache, queue snapshots, and settings

Key server modules:

| Module | Purpose |
|---|---|
| `queueFetcher.ts` | Fetches the mod queue from Reddit with caching and fallback |
| `contextEnricher.ts` | Fetches user profiles and builds context for each queue item |
| `priorityScorer.ts` | Calculates priority scores based on weighted factors |
| `patternDetector.ts` | Detects link clusters, time bursts, and username patterns |
| `alertSystem.ts` | Runs anomaly detection and generates alert objects |
| `modActions.ts` | Executes approve, remove, ban, lock actions via Reddit API |
| `activityTracker.ts` | Tracks mod actions and builds workload statistics |
| `community.ts` | Fetches public subreddit data for the public dashboard |
| `permissions.ts` | Resolves the current user and checks mod status |
| `cache.ts` | Redis cache wrapper with TTL support |
| `logger.ts` | Structured JSON logging for all server events |
| `seed.ts` | Test data generator for development and demo purposes |

### Client

The client is a single-page React application rendered inside a Devvit WebView. It is built with:

- **React 19** — Component rendering and state management
- **TypeScript** — Type safety across all components and hooks
- **Vite** — Build tooling and hot module replacement during development
- **Custom CSS** — No UI framework. Every component is styled with CSS custom properties for a consistent, responsive design system.

Key client modules:

| Module | Purpose |
|---|---|
| `Dashboard.tsx` | Main layout: header, stats, tabs, filter bar |
| `PriorityQueue.tsx` | Renders grouped and individual queue items |
| `QueueItem.tsx` | Single queue row with priority dot, metadata, and actions |
| `DetailModal.tsx` | Full item detail with user context and action buttons |
| `BulkActionBar.tsx` | Sticky bottom bar for bulk actions |
| `WorkloadTab.tsx` | Mod activity breakdown and recent actions |
| `PublicDashboard.tsx` | Community-facing leaderboard and activity feed |
| `PatternAlert.tsx` | Renders pattern detection alerts |
| `AlertBanner.tsx` | Renders anomaly alerts |
| `ContextCard.tsx` | Inline user context display (karma, age, history) |
| `ConfirmDialog.tsx` | Confirmation modal for destructive actions |
| `EmptyState.tsx` | Empty state messaging |
| `LoadingState.tsx` | Loading spinner |

Custom hooks manage data fetching and state:

| Hook | Purpose |
|---|---|
| `useQueue.ts` | Fetches and caches the enriched queue with auto-refresh |
| `useWorkload.ts` | Fetches workload statistics |
| `useSettings.ts` | Manages mod settings with local persistence |
| `usePatterns.ts` | Fetches pattern detection results |

### Data Flow

1. The mod opens the app. The client calls `/api/init` to resolve the current user and check mod status.
2. If the user is a mod, the client loads the mod dashboard. If not, it loads the public dashboard.
3. The client calls `/api/queue` which triggers: queue fetch from Reddit, user context enrichment for each item, priority scoring, and cache storage in Redis.
4. The client calls `/api/anomalies` and `/api/patterns` for alerts.
5. The client renders the priority queue with all enriched data inline.
6. When the mod takes an action, the client calls the appropriate `/api/action/*` endpoint. The server executes the Reddit API call, stores the action in Redis, clears the queue cache, and returns the result.
7. On the next auto-refresh cycle, the queue is re-fetched from Reddit with fresh data.

### Redis Schema

| Key Pattern | Contents |
|---|---|
| `mqcc:mod:{subredditId}:{username}` | Mod action history per user |
| `mqcc:queue:{subredditId}` | Cached queue snapshot with TTL |
| `mqcc:user:{subredditId}:{username}` | Enriched user context with TTL |
| `mqcc:actions:{subredditId}` | Recent mod actions list |
| `mqcc:settings:{subredditId}` | Mod configuration |
| `mqcc:mods:{subredditId}` | List of known moderators |

---

## Installation

### Prerequisites

- Node.js 18+
- Devvit CLI (`npm install -g @devvit/cli`)
- A Reddit account with moderator permissions
- A subreddit where you have full mod permissions

### Setup

```bash
# Clone the repository
git clone https://github.com/arubara2021/Reddit_MQCC
cd mqcc

# Install dependencies
npm install

# Login to Devvit
npm run login

# Start the playtest environment
npm run dev
```

This opens a playtest URL on your subreddit. Navigate to that URL to see the app running.

### Deploy

```bash
# Build and upload to Devvit
npm run deploy

# Submit for Reddit App Directory review
npm run launch
```

### Environment

The app requires no external API keys or environment variables. All Reddit API access is handled through the Devvit SDK. Redis is provided automatically by the Devvit platform.

---

## Usage

### For Moderators

1. Install the app on your subreddit from the Reddit App Directory.
2. Open the app from your subreddit's sidebar or app launcher.
3. The queue tab loads automatically with all reported items sorted by priority.
4. Use the filter bar to narrow by posts, comments, critical, or high severity.
5. Click on any item to see full details, user context, and report reasons.
6. Use the action buttons (Approve, Remove, Ban) on individual items or select multiple items for bulk actions.
7. Check the Workload tab to see your team's activity breakdown.
8. Check the Alerts tab for anomaly detection alerts.
9. Configure auto-refresh and display options in the Settings tab.

### For Community Members

1. Open the app from the subreddit.
2. View the community dashboard showing contributor rankings, health status, and recent mod activity.
3. Switch between weekly, monthly, and all-time views.
4. Your own rank is highlighted if you appear in the leaderboard.

---

## Project Structure

```
src/
  client/
    components/       React components
    hooks/            Custom React hooks
    index.css         Global styles and design tokens
    dashboard.tsx     Client entry point
    dashboard.html    HTML shell
    splash.tsx        Splash screen entry
    splash.html       Splash HTML shell
  server/
    core/             Server-side business logic
    routes/           HTTP route handlers (Hono)
    index.ts          Server entry point
  shared/
    api.ts            Shared TypeScript types
devvit.config.ts      Devvit app configuration
vite.config.ts        Vite build configuration
tsconfig.json         TypeScript project references
eslint.config.js      Linting configuration
package.json          Dependencies and scripts
```

---

## Design Decisions

**No UI framework.** Every component is hand-styled with CSS custom properties. This keeps the bundle small, avoids framework lock-in, and gives full control over the responsive behavior. The design system uses a zinc-tinted dark palette for the mod dashboard and a purple-tinted palette for the public dashboard.

**Redis for everything persistent.** Mod action history, user context cache, queue snapshots, and settings all live in Redis. There is no external database. The Devvit platform provides Redis automatically, so there is zero infrastructure to manage.

**Server-side enrichment.** User context is fetched and cached on the server, not the client. This means the client gets fully enriched data in a single API call instead of making dozens of individual profile requests.

**Graceful degradation.** Every external call (Reddit API, Redis, user profile fetch) has error handling with fallbacks. If the queue fetch fails, cached data is served. If a user profile is unavailable, a default context with unknown values is used. If anomaly detection crashes, the rest of the dashboard still works.

**Seed data for development.** A `/api/seed` endpoint generates realistic test data: 100 mod actions, 25 queue items, and 12 queue appearances. This lets developers see the full UI populated with data without needing a live subreddit with active reports.

---

## Built With

- [Devvit](https://developers.reddit.com/) — Reddit's developer platform
- [Hono](https://hono.dev/) — Lightweight web framework for the server
- [React 19](https://react.dev/) — Client-side UI framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Vite](https://vite.dev/) — Build tooling
- [Redis](https://redis.io/) — In-memory data store (provided by Devvit)

---

## License

MIT
```

This README is written to be read by judges and developers. It leads with the problem, explains what the app actually does in plain language, gives enough technical depth to show it is a real project, and does not oversell anything. It reads like documentation written by someone who built the thing, not like marketing copy.
