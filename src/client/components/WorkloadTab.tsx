import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkload } from '../hooks/useWorkload';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { ConfirmDialog } from './ConfirmDialog';
import { timeAgo } from '../utils/time';
import type { BannedUserRecord } from '../../shared/api';

function StatCard({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function SectionHeader({ title, count, right }: { title: string; count?: number | string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        {count !== undefined && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {count}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{count}</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      </div>
    </div>
  );
}

function BannedSection({
  bannedUsers,
  bannedLoading,
  bannedError,
  onUnban,
  onRefresh,
}: {
  bannedUsers: BannedUserRecord[];
  bannedLoading: boolean;
  bannedError: string | null;
  onUnban: (user: BannedUserRecord) => void;
  onRefresh: () => void;
}) {
  if (bannedLoading) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <SectionHeader title="Banned Users" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row" style={{ padding: 'var(--space-3)' }}>
              <div className="skeleton skeleton-text" style={{ width: 80 }} />
              <div className="skeleton skeleton-text" style={{ width: 50, marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (bannedError) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <SectionHeader title="Banned Users" />
        <p style={{ fontSize: 12, color: 'var(--critical)', marginBottom: 'var(--space-3)' }}>{bannedError}</p>
        <button className="btn-ghost" onClick={onRefresh} style={{ fontSize: 10, padding: '4px 10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (bannedUsers.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <SectionHeader title="Banned Users" count="0" />
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93l14.14 14.14" />
          </svg>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No users currently banned through MQCC.</p>
        </div>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <SectionHeader
        title="Banned Users"
        count={bannedUsers.length}
        right={
          <button
            className="btn-ghost"
            onClick={onRefresh}
            style={{ fontSize: 10, padding: '3px 8px' }}
          >
            Refresh
          </button>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {bannedUsers.map((user, idx) => {
          const isPermanent = user.expiresAt === null;
          const isExpired = !isPermanent && user.expiresAt !== null && user.expiresAt <= now;
          const remainingMs = !isPermanent && user.expiresAt !== null ? user.expiresAt - now : 0;
          const remainingDays = Math.max(0, Math.ceil(remainingMs / 86400000));

          const durationLabel = isPermanent
            ? 'Permanent'
            : isExpired
            ? 'Expired'
            : remainingDays + 'd remaining';

          const durationColor = isPermanent
            ? 'var(--critical)'
            : isExpired
            ? 'var(--text-muted)'
            : 'var(--high)';

          const durationBg = isPermanent
            ? 'var(--critical-bg)'
            : isExpired
            ? 'transparent'
            : 'var(--high-bg)';

          const durationBorder = isPermanent
            ? 'var(--critical-border)'
            : isExpired
            ? 'var(--border-subtle)'
            : 'var(--high-border)';

          const isLast = idx === bannedUsers.length - 1;

          return (
            <div
              key={user.username}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--critical-bg)',
                  border: '1px solid var(--critical-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--critical)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M4.93 4.93l14.14 14.14" />
                  </svg>
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      u/{user.username}
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: durationColor,
                      background: durationBg,
                      border: '1px solid ' + durationBorder,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}>
                      {durationLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2, flexWrap: 'wrap' }}>
                    {user.reason && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {user.reason}
                      </span>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      by u/{user.bannedBy}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {timeAgo(user.bannedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="btn-ghost"
                onClick={() => onUnban(user)}
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  color: 'var(--success)',
                  borderColor: 'var(--success-border)',
                  flexShrink: 0,
                }}
              >
                Unban
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WorkloadTab() {
  const { workload, loading, error, refresh } = useWorkload();

  const [bannedUsers, setBannedUsers] = useState<BannedUserRecord[]>([]);
  const [bannedLoading, setBannedLoading] = useState(true);
  const [bannedError, setBannedError] = useState<string | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<BannedUserRecord | null>(null);
  const [unbanLoading, setUnbanLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const fetchingBannedRef = useRef(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchBanned = useCallback(async () => {
    if (fetchingBannedRef.current) return;
    fetchingBannedRef.current = true;
    setBannedLoading(true);
    try {
      const res = await fetch('/api/banned');
      if (!res.ok) throw new Error('Failed to fetch banned users');
      const data = await res.json();
      setBannedUsers(data.banned || []);
      setBannedError(null);
    } catch (e) {
      setBannedError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setBannedLoading(false);
      fetchingBannedRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchBanned();
  }, [fetchBanned]);

  const handleUnban = useCallback(async () => {
    if (!unbanTarget) return;
    setUnbanLoading(true);
    try {
      const res = await fetch('/api/action/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: unbanTarget.username }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannedUsers((prev) => prev.filter((b) => b.username !== unbanTarget.username));
        showToast('Unbanned u/' + unbanTarget.username, 'success');
      } else {
        showToast(data.message || 'Unban failed', 'error');
      }
    } catch {
      showToast('Unban failed — try again', 'error');
    } finally {
      setUnbanLoading(false);
      setUnbanTarget(null);
    }
  }, [unbanTarget, showToast]);

  const handleRefresh = useCallback(() => {
    refresh();
    fetchBanned();
  }, [refresh, fetchBanned]);

  if (loading) {
    return <LoadingState message="Loading workload data..." />;
  }

  if (error) {
    return (
      <div
        style={{
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 'var(--space-3)' }}>{error}</p>
        <button className="btn-ghost" onClick={handleRefresh} style={{ fontSize: 11 }}>
          Retry
        </button>
      </div>
    );
  }

  if (!workload || workload.totalActions === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <EmptyState
          title="No activity yet"
          description="Mod actions will appear here once you start approving, removing, or banning from the queue."
        />
        <BannedSection
          bannedUsers={bannedUsers}
          bannedLoading={bannedLoading}
          bannedError={bannedError}
          onUnban={setUnbanTarget}
          onRefresh={fetchBanned}
        />
        {unbanTarget && (
          <ConfirmDialog
            title={'Unban u/' + unbanTarget.username}
            message={'This will remove the ban for u/' + unbanTarget.username + '. They will be able to post and comment again.'}
            loading={unbanLoading}
            onConfirm={handleUnban}
            onCancel={() => setUnbanTarget(null)}
          />
        )}
        {toast && (
          <div className={'toast-enter mod-toast mod-toast-' + toast.type}>{toast.msg}</div>
        )}
      </div>
    );
  }

  const modEntries = Object.entries(workload.actionsByMod).sort(([, a], [, b]) => b - a);
  const maxModCount = modEntries.length > 0 ? modEntries[0][1] : 1;
  const typeEntries = Object.entries(workload.actionsByType).sort(([, a], [, b]) => b - a);
  const typeColorMap: Record<string, string> = {
    remove: 'var(--danger)',
    ban: 'var(--critical)',
    approve: 'var(--success)',
    lock: 'var(--info)',
    unban: 'var(--accent)',
    removeAndBan: '#881337',
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        <StatCard value={workload.totalActions} label="Actions" />
        <StatCard value={modEntries.length} label="Mods" />
        <StatCard
          value={workload.topFlaggedUsers.length}
          label="Flagged"
          color={workload.topFlaggedUsers.length > 0 ? 'var(--high)' : undefined}
        />
      </div>

      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <SectionHeader title="Actions by Type" count={workload.totalActions + ' total'} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {typeEntries.map(([type, count]) => (
            <BarRow
              key={type}
              label={type}
              count={count}
              total={workload.totalActions}
              color={typeColorMap[type] || 'var(--accent)'}
            />
          ))}
        </div>
      </div>

      {modEntries.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <SectionHeader title="Mod Activity" count={modEntries.length + ' active'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {modEntries.map(([mod, count]) => (
              <BarRow
                key={mod}
                label={mod || 'unknown'}
                count={count}
                total={maxModCount}
                color="var(--accent-gradient)"
              />
            ))}
          </div>
        </div>
      )}

      {workload.topFlaggedUsers.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <SectionHeader title="Top Flagged Users" count={workload.topFlaggedUsers.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {workload.topFlaggedUsers.map((user, idx) => {
              const severityColor =
                user.actionCount >= 5 ? 'var(--critical)' :
                user.actionCount >= 3 ? 'var(--high)' :
                'var(--text-secondary)';

              const severityBg =
                user.actionCount >= 5 ? 'var(--critical-bg)' :
                user.actionCount >= 3 ? 'var(--high-bg)' :
                'transparent';

              const isLast = idx === workload.topFlaggedUsers.length - 1;

              return (
                <div
                  key={user.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) 0',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 20, textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>
                      {idx + 1}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      u/{user.username}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                    <span className="hide-mobile" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {timeAgo(new Date(user.lastAction).getTime())}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: severityColor,
                      fontFamily: 'var(--font-mono)',
                      background: severityBg,
                      padding: '1px 8px',
                      borderRadius: 'var(--radius-full)',
                      minWidth: 32,
                      textAlign: 'center',
                    }}>
                      {user.actionCount}x
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BannedSection
        bannedUsers={bannedUsers}
        bannedLoading={bannedLoading}
        bannedError={bannedError}
        onUnban={setUnbanTarget}
        onRefresh={fetchBanned}
      />

      {workload.recentActions.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <SectionHeader title="Recent Actions" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {workload.recentActions.slice(0, 15).map((action, idx) => {
              const actionColor =
                action.action === 'approve' ? 'var(--success)' :
                action.action === 'remove' ? 'var(--danger)' :
                action.action === 'ban' ? 'var(--critical)' :
                'var(--info)';

              const actionBg =
                action.action === 'approve' ? 'var(--success-bg)' :
                action.action === 'remove' ? 'var(--danger-bg)' :
                action.action === 'ban' ? 'var(--critical-bg)' :
                'var(--info-bg)';

              const isLast = idx >= Math.min(workload.recentActions.length, 15) - 1;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) 0',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: actionColor,
                      background: actionBg,
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-sm)',
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {action.action}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      u/{action.targetAuthor || 'unknown'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                    {timeAgo(action.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="btn-ghost"
        onClick={handleRefresh}
        style={{ fontSize: 11, alignSelf: 'center', marginTop: 'var(--space-2)' }}
      >
        Refresh Workload
      </button>

      {unbanTarget && (
        <ConfirmDialog
          title={'Unban u/' + unbanTarget.username}
          message={'This will remove the ban for u/' + unbanTarget.username + '. They will be able to post and comment in this subreddit again.'}
          loading={unbanLoading}
          onConfirm={handleUnban}
          onCancel={() => setUnbanTarget(null)}
        />
      )}

      {toast && (
        <div className={'toast-enter mod-toast mod-toast-' + toast.type}>{toast.msg}</div>
      )}
    </div>
  );
}
