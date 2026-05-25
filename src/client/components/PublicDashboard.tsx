import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { timeAgo } from '../utils/time';

type LeaderboardEntry = { name: string; score: number };
type LeaderboardTab = 'contributors' | 'comments' | 'karma';
type TimeRange = 'week' | 'month' | 'all';

type CommunityData = {
  stats: { active: number; posts: number; health: number };
  contributors: LeaderboardEntry[];
  commenters: LeaderboardEntry[];
  karma: LeaderboardEntry[];
  trendingPosts: Array<{
    title: string;
    permalink: string;
    author: string;
    numComments: number;
    createdAt: number;
    subreddit: string;
  }>;
  recentActivity: Array<{ action: string; author: string; time: number }>;
};

const TABS: Array<{ id: LeaderboardTab; label: string; icon: string }> = [
  { id: 'contributors', label: 'Top Contributors', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'comments', label: 'Most Comments', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { id: 'karma', label: 'Karma Leaders', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
];

const TIME_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const RANK_STYLES: Record<number, { bg: string; border: string; glow: string; text: string }> = {
  1: { bg: 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(139,92,246,0.06) 100%)', border: 'rgba(167,139,250,0.35)', glow: '0 0 20px rgba(167,139,250,0.15)', text: '#c4b5fd' },
  2: { bg: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(124,58,237,0.04) 100%)', border: 'rgba(139,92,246,0.25)', glow: '0 0 14px rgba(139,92,246,0.1)', text: '#a78bfa' },
  3: { bg: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.03) 100%)', border: 'rgba(124,58,237,0.2)', glow: '0 0 10px rgba(124,58,237,0.08)', text: '#8b5cf6' },
};

const RANK_BADGE: Record<number, string> = {
  1: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
  2: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
  3: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
};

const REFRESH_INTERVAL_MS = 30000;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      prevRef.current = 0;
      return;
    }
    const from = prevRef.current;
    const start = Date.now();
    let frame: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

export function PublicDashboard({ subredditName }: { subredditName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('contributors');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [communityData, setCommunityData] = useState<CommunityData | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const handleCopy = useCallback(async (url: string, target: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    }
  }, []);

  useEffect(() => {
    fetch('/api/init')
      .then((r) => r.json())
      .then((data) => {
        if (data?.username) setViewerName(data.username);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const res = await fetch('/api/community?subreddit=' + encodeURIComponent(subredditName));
      if (!res.ok) throw new Error('Failed to load community data');

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load');

      const data: CommunityData = json.data;

      const hasData =
        data.contributors.length > 0 ||
        data.commenters.length > 0 ||
        data.karma.length > 0 ||
        data.recentActivity.length > 0;

      if (hasData) {
        setCommunityData(data);
        setError(null);
      } else if (!hasFetchedRef.current) {
        setError('No community activity yet. Posts and comments will appear here as users engage.');
      }

      setLastUpdated(Date.now());
      hasFetchedRef.current = true;
    } catch (e) {
      if (!hasFetchedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [subredditName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (!showDropdown) return;
    const close = () => setShowDropdown(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showDropdown]);

  const leaderboard = useMemo(() => {
    if (!communityData) return { contributors: [], comments: [], karma: [] };
    return {
      contributors: communityData.contributors || [],
      comments: communityData.commenters || [],
      karma: communityData.karma || [],
    };
  }, [communityData]);

  const viewerRank = useMemo(() => {
    const ranks: Record<LeaderboardTab, number> = { contributors: 0, comments: 0, karma: 0 };
    if (!viewerName) return ranks;
    const vn = viewerName.toLowerCase();
    for (const tab of ['contributors', 'comments', 'karma'] as LeaderboardTab[]) {
      const idx = leaderboard[tab].findIndex((e) => e.name.toLowerCase() === vn);
      if (idx >= 0) ranks[tab] = idx + 1;
    }
    return ranks;
  }, [viewerName, leaderboard]);

  const viewerScore = useMemo(() => {
    const scores: Record<LeaderboardTab, number> = { contributors: 0, comments: 0, karma: 0 };
    if (!viewerName) return scores;
    const vn = viewerName.toLowerCase();
    for (const tab of ['contributors', 'comments', 'karma'] as LeaderboardTab[]) {
      const entry = leaderboard[tab].find((e) => e.name.toLowerCase() === vn);
      if (entry) scores[tab] = entry.score;
    }
    return scores;
  }, [viewerName, leaderboard]);

  const currentList = leaderboard[activeTab] || [];
  const maxScore = currentList.length > 0 ? Math.max(currentList[0].score, 1) : 1;
  const activeRangeLabel = TIME_RANGES.find((t) => t.id === timeRange)?.label || 'This Week';

  const heroStats = communityData?.stats || { active: 0, posts: 0, health: 0 };
  const recentActivity = communityData?.recentActivity || [];
  const trendingPosts = communityData?.trendingPosts || [];

  const getTabCountLabel = (): string => {
    const count = currentList.length;
    if (activeTab === 'contributors') return count + ' contributor' + (count !== 1 ? 's' : '');
    if (activeTab === 'comments') return count + ' commenter' + (count !== 1 ? 's' : '');
    return count + ' user' + (count !== 1 ? 's' : '');
  };

  const getScoreUnit = (): string => {
    if (activeTab === 'contributors') return 'posts';
    if (activeTab === 'comments') return 'comments';
    return 'karma';
  };

  if (loading) {
    return (
      <div className="public-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--pub-accent)', width: 28, height: 28, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 12, color: 'var(--pub-text-muted)' }}>Loading community data...</div>
        </div>
      </div>
    );
  }

  if (error && !communityData) {
    return (
      <div className="public-root">
        <div className="public-container" style={{ paddingTop: 80 }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--pub-text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px', opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pub-text-primary)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>
              No data available
            </div>
            <div style={{ fontSize: 12, color: 'var(--pub-text-muted)', marginBottom: 16, lineHeight: 1.6, maxWidth: 300, margin: '0 auto 16px' }}>
              {error}
            </div>
            <button
              onClick={loadData}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--pub-border-active)',
                background: 'var(--pub-accent-muted)',
                color: 'var(--pub-accent-bright)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-root">
      <style>{`
        @keyframes pubFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pub-card { transition: all 0.2s ease; }
        .pub-card:hover {
          border-color: var(--pub-border-active) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.08);
        }
        .pub-copy-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          background: #042f1a;
          color: #4ade80;
          border: 1px solid rgba(22, 163, 74, 0.3);
          padding: 8px 16px;
          border-radius: 8px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          animation: pubFadeIn 0.2s ease forwards;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .pub-refresh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          background: var(--pub-accent-muted);
          border: 1px solid var(--pub-accent-border);
          color: var(--pub-accent-bright);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .pub-refresh-btn:hover {
          background: rgba(139, 92, 246, 0.15);
          border-color: var(--pub-border-active);
        }
      `}</style>

      <div className="public-container">

        <div className="public-hero">
          <div className="public-hero-inner">
            <div className="public-hero-label">Community Pulse</div>
            <div className="public-hero-title">r/{subredditName}</div>
            <div className="public-hero-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="public-hero-stat">
                <div className="public-hero-stat-value"><AnimatedNumber value={heroStats.active} /></div>
                <div className="public-hero-stat-label">Active</div>
              </div>
              <div className="public-hero-stat">
                <div className="public-hero-stat-value public-hero-stat-value-white"><AnimatedNumber value={heroStats.posts} /></div>
                <div className="public-hero-stat-label">Posts</div>
              </div>
            </div>
          </div>
        </div>

        <div className="public-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={'public-tab' + (activeTab === tab.id ? ' public-tab-active' : '')}
              onClick={() => setActiveTab(tab.id)}
            >
              <svg className="public-tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              <span className="public-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="public-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className="public-toolbar-count">{getTabCountLabel()}</div>
            {lastUpdated > 0 && (
              <span style={{ fontSize: 9, color: 'var(--pub-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {Math.round((Date.now() - lastUpdated) / 1000)}s ago
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className="public-dropdown">
              <button
                className="public-dropdown-btn"
                onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {activeRangeLabel}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showDropdown && (
                <div className="public-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  {TIME_RANGES.map((t) => (
                    <button
                      key={t.id}
                      className={'public-dropdown-item' + (timeRange === t.id ? ' public-dropdown-item-active' : '')}
                      onClick={() => { setTimeRange(t.id); setShowDropdown(false); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="pub-refresh-btn"
              onClick={loadData}
              title="Refresh community data"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>
          </div>
        </div>

        {viewerRank[activeTab] > 0 && (
          <div
            className="pub-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.04) 100%)',
              border: '1px solid var(--pub-accent-border)',
              boxShadow: '0 0 20px rgba(139,92,246,0.1)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800,
              color: '#ffffff', flexShrink: 0,
            }}>
              #{viewerRank[activeTab]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pub-accent-bright)', fontFamily: 'var(--font-mono)' }}>
                Your Rank
              </div>
              <div style={{ fontSize: 10, color: 'var(--pub-text-muted)', marginTop: 2 }}>
                u/{viewerName} &middot; {viewerScore[activeTab]} {getScoreUnit()}
              </div>
            </div>
          </div>
        )}

        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--pub-text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px', opacity: 0.4 }}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pub-text-primary)', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
              No data yet
            </div>
            <div style={{ fontSize: 12, color: 'var(--pub-text-muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
              Activity will appear as users post and comment.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {currentList.map((entry, idx) => {
              const rank = idx + 1;
              const barWidth = maxScore > 0 ? Math.round((entry.score / maxScore) * 100) : 0;
              const isViewer = viewerName !== null && entry.name.toLowerCase() === viewerName.toLowerCase();
              const rs = RANK_STYLES[rank];
              const userUrl = 'https://reddit.com/user/' + entry.name;

              return (
                <div
                  key={entry.name}
                  className="pub-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-lg)',
                    background: rs ? rs.bg : 'var(--pub-bg-card)',
                    border: '1px solid ' + (isViewer ? 'var(--pub-accent-border)' : rs ? rs.border : 'var(--pub-border)'),
                    boxShadow: isViewer ? '0 0 0 1px var(--pub-accent-border)' : rs ? rs.glow : 'none',
                    cursor: 'pointer',
                    animation: 'pubFadeIn 0.3s ease forwards',
                    animationDelay: (idx * 0.05) + 's',
                  }}
                  onClick={() => handleCopy(userUrl, 'user_' + entry.name)}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                    background: rank <= 3 ? RANK_BADGE[rank] : 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800,
                    color: rank <= 3 ? '#0b0015' : 'var(--pub-text-muted)',
                    boxShadow: rank === 1 ? '0 2px 8px rgba(167,139,250,0.3)' : 'none',
                  }}>
                    {rank}
                  </div>

                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                    background: rank <= 3 ? 'rgba(139,92,246,0.1)' : 'var(--bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 10, fontWeight: 700,
                    color: rank <= 3 ? 'var(--pub-accent-bright)' : 'var(--pub-text-muted)',
                  }}>
                    {entry.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: isViewer ? 'var(--pub-accent-bright)' : 'var(--pub-text-primary)',
                        fontFamily: 'var(--font-mono)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        u/{entry.name}
                      </span>
                      {isViewer && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, color: 'var(--pub-accent-bright)',
                          background: 'var(--pub-accent-muted)', border: '1px solid var(--pub-accent-border)',
                          padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                          letterSpacing: '0.05em', flexShrink: 0,
                        }}>
                          You
                        </span>
                      )}
                      {copiedTarget === 'user_' + entry.name && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, color: 'var(--success)',
                          background: 'var(--success-bg)', border: '1px solid var(--success-border)',
                          padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          Copied
                        </span>
                      )}
                    </div>
                    <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: barWidth + '%', height: '100%', background: rank <= 3 ? 'var(--pub-accent)' : 'rgba(139,92,246,0.4)', borderRadius: 2 }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: rs ? rs.text : 'var(--pub-accent-bright)', lineHeight: 1 }}>
                      {entry.score.toLocaleString()}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--pub-text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {getScoreUnit()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {recentActivity.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="public-activity-header">
              Recent Activity
              <span className="public-activity-header-line" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActivity.map((act, idx) => (
                <div
                  key={idx}
                  className="pub-card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--pub-bg-card)', border: '1px solid var(--pub-border)',
                    animation: 'pubFadeIn 0.3s ease forwards',
                    animationDelay: (idx * 0.05) + 's',
                  }}
                >
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--pub-accent)', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--pub-text-secondary)', flex: 1 }}>
                    <span style={{ fontWeight: 600, color: 'var(--pub-text-primary)', fontFamily: 'var(--font-mono)' }}>
                      u/{act.author}
                    </span>
                    {' '}&middot;{' '}{act.action}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--pub-text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {timeAgo(act.time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trendingPosts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="public-activity-header">
              Trending Posts
              <span className="public-activity-header-line" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {trendingPosts.map((post, idx) => (
                <div
                  key={idx}
                  className="pub-card"
                  style={{
                    background: 'var(--pub-bg-card)', border: '1px solid var(--pub-border)',
                    borderRadius: 'var(--radius-lg)', padding: '12px 14px', cursor: 'pointer',
                    animation: 'pubFadeIn 0.35s ease forwards',
                    animationDelay: (0.1 + idx * 0.06) + 's',
                  }}
                  onClick={() => {
                    if (post.permalink) handleCopy('https://reddit.com' + post.permalink, 'post_' + idx);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-md)',
                      background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--pub-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--pub-text-primary)',
                        lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-display)',
                      }}>
                        {post.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--pub-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          u/{post.author}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--pub-border)' }}>&middot;</span>
                        <span style={{ fontSize: 10, color: 'var(--pub-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {timeAgo(post.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: '16px 0 8px', opacity: 0.4,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--pub-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontSize: 9, color: 'var(--pub-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            <span style={{ fontWeight: 700, color: 'var(--pub-accent)' }}>MQCC</span> &middot; Built for healthy communities
          </span>
        </div>

      </div>

      {copiedTarget && (
        <div className="pub-copy-toast">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
