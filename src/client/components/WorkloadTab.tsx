// src/client/components/WorkloadTab.tsx

import { useWorkload } from '../hooks/useWorkload';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { timeAgo } from '../utils/time';

export function WorkloadTab() {
  const { workload, loading, error, refresh } = useWorkload();

  if (loading) {
    return <LoadingState message="Loading workload data..." />;
  }

  if (error) {
    return (
      <div
        style={{
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 'var(--space-3)' }}>{error}</p>
        <button className="btn-ghost" onClick={refresh} style={{ fontSize: 11 }}>
          Retry
        </button>
      </div>
    );
  }

  if (!workload || workload.totalActions === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Mod actions will appear here once you start approving, removing, or banning from the queue."
      />
    );
  }

  const modEntries = Object.entries(workload.actionsByMod).sort(([, a], [, b]) => b - a);
  const maxModCount = modEntries.length > 0 ? modEntries[0][1] : 1;
  const typeEntries = Object.entries(workload.actionsByType).sort(([, a], [, b]) => b - a);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        <div className="stat-card">
          <div className="stat-value">{workload.totalActions}</div>
          <div className="stat-label">Actions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{modEntries.length}</div>
          <div className="stat-label">Mods</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{workload.topFlaggedUsers.length}</div>
          <div className="stat-label">Flagged</div>
        </div>
      </div>

      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            Actions by Type
          </h3>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {workload.totalActions} total
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {typeEntries.map(([type, count]) => {
            const pct = workload.totalActions > 0 ? Math.round((count / workload.totalActions) * 100) : 0;
            const typeColor =
              type === 'remove' ? 'var(--danger)' :
              type === 'ban' ? 'var(--critical)' :
              type === 'approve' ? 'var(--success)' :
              type === 'lock' ? 'var(--info)' :
              'var(--accent)';

            return (
              <div key={type}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>{type}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: typeColor }}>{count}</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: 4, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: typeColor, borderRadius: 999, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modEntries.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Mod Activity
            </h3>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {modEntries.length} active
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {modEntries.map(([mod, count]) => {
              const pct = workload.totalActions > 0 ? Math.round((count / workload.totalActions) * 100) : 0;
              const barWidth = maxModCount > 0 ? Math.round((count / maxModCount) * 100) : 0;

              return (
                <div key={mod}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {mod || 'unknown'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: barWidth + '%', height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {workload.topFlaggedUsers.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              Top Flagged Users
            </h3>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {workload.topFlaggedUsers.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {workload.topFlaggedUsers.map((user, idx) => {
              const severityColor =
                user.actionCount >= 5 ? 'var(--critical)' :
                user.actionCount >= 3 ? 'var(--high)' :
                'var(--text-secondary)';

              return (
                <div
                  key={user.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) 0',
                    borderBottom: idx < workload.topFlaggedUsers.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 16, textAlign: 'right', flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <span style={{
                      fontSize: 11,
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

      {workload.recentActions.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
            Recent Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {workload.recentActions.slice(0, 15).map((action, idx) => {
              const actionColor =
                action.action === 'approve' ? 'var(--success)' :
                action.action === 'remove' ? 'var(--danger)' :
                action.action === 'ban' ? 'var(--critical)' :
                'var(--info)';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) 0',
                    borderBottom: idx < Math.min(workload.recentActions.length, 15) - 1 ? '1px solid var(--border-subtle)' : 'none',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: actionColor,
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {action.action}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      u/{action.targetAuthor || 'unknown'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {timeAgo(action.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button className="btn-ghost" onClick={refresh} style={{ fontSize: 11, alignSelf: 'center', marginTop: 'var(--space-2)' }}>
        Refresh Workload
      </button>
    </div>
  );
}
