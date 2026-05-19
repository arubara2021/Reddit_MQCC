// src/client/components/PublicDashboard.tsx

import { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../utils/time';

type LeaderboardEntry = {
  name: string;
  score: number;
};

type LeaderboardTab = 'contributors' | 'comments' | 'karma';
type TimeRange = 'week' | 'month' | 'all';

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

function getHealthColor(health: number): string {
  if (health >= 85) return 'var(--pub-success)';
  if (health >= 65) return 'var(--pub-accent-bright)';
  if (health >= 45) return '#f59e0b';
  return '#ef4444';
}

function getHealthLabel(health: number): string {
  if (health >= 85) return 'Excellent';
  if (health >= 65) return 'Good';
  if (health >= 45) return 'Fair';
  return 'Needs Attention';
}

export function PublicDashboard({ subredditName }: { subredditName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('contributors');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [showDropdown, setShowDropdown] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Record<LeaderboardTab, LeaderboardEntry[]>>({
    contributors: [],
    comments: [],
    karma: [],
  });
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [viewerRank, setViewerRank] = useState<Record<LeaderboardTab, number>>({
    contributors: 0,
    comments: 0,
    karma: 0,
  });
  const [viewerScore, setViewerScore] = useState<Record<LeaderboardTab, number>>({
    contributors: 0,
    comments: 0,
    karma: 0,
  });
  const [heroStats, setHeroStats] = useState({ active: 0, posts: 0, health: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{ action: string; author: string; time: number }>>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const initRes = await fetch('/api/init').then((r) => r.json()).catch(() => null);
      const username = initRes?.username || null;
      setViewerName(username);

      const communityRes = await fetch('/api/community?subreddit=' + encodeURIComponent(subredditName));
      const communityData = await communityRes.json();

      if (!communityRes.ok || !communityData.success) {
        throw new Error(communityData.error || 'Failed to load community data');
      }

      const data = communityData.data;

      setHeroStats({
        active: data.stats?.active || 0,
        posts: data.stats?.posts || 0,
        health: data.stats?.health || 0,
      });

      const contributors = data.contributors || [];
      const commenters = data.commenters || [];
      const karma = data.karma || [];

      setLeaderboard({
        contributors,
        comments: commenters,
        karma,
      });

      if (username) {
        const findRankAndScore = (list: LeaderboardEntry[]): { rank: number; score: number } => {
          const idx = list.findIndex((e) => e.name.toLowerCase() === username.toLowerCase());
          if (idx >= 0) return { rank: idx + 1, score: list[idx].score };
          return { rank: 0, score: 0 };
        };

        const c = findRankAndScore(contributors);
        const cm = findRankAndScore(commenters);
        const k = findRankAndScore(karma);

        setViewerRank({ contributors: c.rank, comments: cm.rank, karma: k.rank });
        setViewerScore({ contributors: c.score, comments: cm.score, karma: k.score });
      }

      setRecentActivity(data.recentActivity || []);
    } catch (e) {
      console.error('[PublicDashboard] Load failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subredditName]);

  useEffect(() => {
    if (!showDropdown) return;
    const close = () => setShowDropdown(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showDropdown]);

  const currentList = leaderboard[activeTab];
  const maxScore = currentList.length > 0 ? currentList[0].score : 1;
  const activeRangeLabel = TIME_RANGES.find((t) => t.id === timeRange)?.label || 'This Week';

  const getTabCountLabel = (): string => {
    const count = currentList.length;
    if (activeTab === 'contributors') return count + ' contributors';
    if (activeTab === 'comments') return count + ' commenters';
    return count + ' users';
  };

  if (loading) {
    return (
      <div className="public-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--pub-accent)', width: 28, height: 28, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 12, color: 'var(--pub-text-muted)' }}>Loading community data...</div>
        </div>
      </div>
    );
  }

  if (error && heroStats.posts === 0) {
    return (
      <div className="public-root">
        <div className="public-container" style={{ paddingTop: 80 }}>
          <div className="public-list-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--pub-text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 16px', opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="public-list-empty-title">Could not load data</div>
            <div className="public-list-empty-desc">{error}</div>
            <button
              onClick={loadData}
              style={{
                marginTop: 16,
                padding: '8px 20px',
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
      <div className="public-container">

        <div className="public-hero animate-fade-in">
          <div className="public-hero-inner">
            <div className="public-hero-label">Community Pulse</div>
            <div className="public-hero-title">r/{subredditName}</div>

            <div className="public-hero-badges">
              {heroStats.health >= 70 ? (
                <span className="public-badge public-badge-healthy">
                  <span className="public-badge-dot" style={{ background: 'var(--pub-success)' }} />
                  Healthy
                </span>
              ) : (
                <span className="public-badge" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                  <span className="public-badge-dot" style={{ background: '#f59e0b' }} />
                  {getHealthLabel(heroStats.health)}
                </span>
              )}
              {heroStats.active > 0 && (
                <span className="public-badge public-badge-active">
                  <span className="public-badge-dot" style={{ background: 'var(--pub-info)', animation: 'pulse 2s ease infinite' }} />
                  Active
                </span>
              )}
            </div>

            <div className="public-hero-stats">
              <div className="public-hero-stat">
                <div className="public-hero-stat-value">
                  <AnimatedNumber value={heroStats.active} />
                </div>
                <div className="public-hero-stat-label">Active</div>
              </div>
              <div className="public-hero-stat">
                <div className="public-hero-stat-value public-hero-stat-value-white">
                  <AnimatedNumber value={heroStats.posts} />
                </div>
                <div className="public-hero-stat-label">Posts</div>
              </div>
              <div className="public-hero-stat">
                <div className="public-hero-stat-value" style={{ color: getHealthColor(heroStats.health) }}>
                  {heroStats.health > 0 ? heroStats.health + '%' : '--'}
                </div>
                <div className="public-hero-stat-label">{heroStats.health > 0 ? getHealthLabel(heroStats.health) : 'Health'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="public-tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={'public-tab' + (isActive ? ' public-tab-active' : '')}
                onClick={() => setActiveTab(tab.id)}
              >
                <svg
                  className="public-tab-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={tab.icon} />
                </svg>
                <span className="public-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="public-toolbar">
          <div className="public-toolbar-count">{getTabCountLabel()}</div>

          <div className="public-dropdown">
            <button
              className="public-dropdown-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
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
                    onClick={() => {
                      setTimeRange(t.id);
                      setShowDropdown(false);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {currentList.length === 0 ? (
          <div className="public-list-empty animate-fade-in">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--pub-text-muted)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block', margin: '0 auto 16px', opacity: 0.4 }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div className="public-list-empty-title">No data yet</div>
            <div className="public-list-empty-desc">
              The leaderboard will populate as the community becomes active.
            </div>
          </div>
        ) : (
          <div className="public-list animate-fade-in">
            {currentList.map((entry, idx) => {
              const barWidth = maxScore > 0 ? Math.round((entry.score / maxScore) * 100) : 0;
              const isViewer = viewerName !== null && entry.name.toLowerCase() === viewerName.toLowerCase();
              const isTop1 = idx === 0;
              const isTop2 = idx === 1;
              const isTop3 = idx === 2;

              let cardClass = 'public-rank-card';
              if (isTop1) cardClass += ' public-rank-card-top1';
              else if (isTop2) cardClass += ' public-rank-card-top2';
              else if (isTop3) cardClass += ' public-rank-card-top3';
              if (isViewer) cardClass += ' public-rank-card-viewer';

              let posClass = 'public-rank-position';
              if (isTop1) posClass += ' public-rank-position-1';
              else if (isTop2) posClass += ' public-rank-position-2';
              else if (isTop3) posClass += ' public-rank-position-3';
              else posClass += ' public-rank-position-default';

              return (
                <div key={entry.name} className={cardClass}>
                  <div className="public-rank-bar" style={{ width: barWidth + '%' }} />
                  <div className={posClass}>{idx + 1}</div>
                  <div className="public-rank-avatar">{entry.name.charAt(0).toUpperCase()}</div>
                  <div className="public-rank-info">
                    <div className="public-rank-name-row">
                      <span className="public-rank-name">u/{entry.name}</span>
                      {isViewer && <span className="public-rank-you-tag">You</span>}
                    </div>
                    <div className="public-rank-bar-track">
                      <div className="public-rank-bar-fill" style={{ width: barWidth + '%' }} />
                    </div>
                  </div>
                  <div className="public-rank-score">{entry.score.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}

        {viewerName && viewerRank[activeTab] > 0 && (
          <div className="public-your-rank animate-fade-in">
            <div className="public-your-rank-left">
              <div className="public-your-rank-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pub-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <div className="public-your-rank-label">Your Rank</div>
                <div className="public-your-rank-username">u/{viewerName}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="public-your-rank-number">#{viewerRank[activeTab]}</div>
              {viewerScore[activeTab] > 0 && (
                <div style={{ fontSize: 10, color: 'var(--pub-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {viewerScore[activeTab].toLocaleString()}{' '}
                  {activeTab === 'karma' ? 'karma' : activeTab === 'contributors' ? 'posts' : 'comments'}
                </div>
              )}
            </div>
          </div>
        )}

        {recentActivity.length > 0 && (
          <div className="animate-fade-in" style={{ marginTop: 8 }}>
            <div className="public-activity-header">
              Recent Activity
              <span className="public-activity-header-line" />
            </div>
            <div className="public-activity-list">
              {recentActivity.map((item, idx) => {
                let actionClass = 'public-activity-action';
                if (item.action === 'approve') actionClass += ' public-activity-action-approve';
                else if (item.action === 'remove') actionClass += ' public-activity-action-remove';
                else if (item.action === 'ban') actionClass += ' public-activity-action-ban';
                else actionClass += ' public-activity-action-approve';

                return (
                  <div key={idx} className="public-activity-item">
                    <span className={actionClass}>{item.action}</span>
                    <span className="public-activity-author">u/{item.author}</span>
                    <span className="public-activity-time">{timeAgo(item.time)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="public-footer">
          <div className="public-footer-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="public-footer-text">
            Powered by <span className="public-footer-brand">MQCC</span>
          </div>
        </div>

      </div>
    </div>
  );
}
