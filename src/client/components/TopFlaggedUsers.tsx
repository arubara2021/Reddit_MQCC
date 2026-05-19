// src/client/components/TopFlaggedUsers.tsx

import { memo } from 'react';
import { timeAgo } from '../utils/time';

interface FlaggedUser {
  username: string;
  actionCount: number;
  lastAction: string;
}

interface TopFlaggedUsersProps {
  users: FlaggedUser[];
}

export const TopFlaggedUsers = memo(function TopFlaggedUsers({
  users,
}: TopFlaggedUsersProps) {
  if (users.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
          Top Flagged Users
        </h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
          No flagged users yet.
        </p>
      </div>
    );
  }

  const maxCount = users.length > 0 ? users[0].actionCount : 1;

  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          Top Flagged Users
        </h3>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {users.length} user{users.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div
          className="hide-mobile"
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 50px 50px 60px',
            gap: 'var(--space-2)',
            alignItems: 'center',
            padding: 'var(--space-1) var(--space-2)',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-1)',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>#</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>User</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>Act</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>%</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right' }}>Last</span>
        </div>

        {users.map((user, idx) => {
          const barWidth = maxCount > 0 ? Math.round((user.actionCount / maxCount) * 100) : 0;

          const severityColor =
            user.actionCount >= 5 ? 'var(--critical)' :
            user.actionCount >= 3 ? 'var(--high)' :
            user.actionCount >= 2 ? 'var(--medium)' :
            'var(--text-secondary)';

          const severityBg =
            user.actionCount >= 5 ? 'var(--critical-bg)' :
            user.actionCount >= 3 ? 'var(--high-bg)' :
            user.actionCount >= 2 ? 'var(--medium-bg)' :
            'var(--bg-hover)';

          return (
            <div
              key={user.username}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) var(--space-3)',
                background: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                position: 'relative',
                gap: 'var(--space-2)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: barWidth + '%',
                  background: severityBg,
                  borderRadius: 'var(--radius-sm)',
                  opacity: 0.4,
                  transition: 'width 0.4s ease',
                  zIndex: 0,
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', position: 'relative', zIndex: 1, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', width: 16, flexShrink: 0 }}>
                  {idx + 1}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  u/{user.username}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', position: 'relative', zIndex: 1, flexShrink: 0 }}>
                <span className="hide-mobile" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {timeAgo(new Date(user.lastAction).getTime())}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: severityColor,
                    fontFamily: 'var(--font-mono)',
                    background: severityBg,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid ' + (user.actionCount >= 5 ? 'var(--critical-border)' : user.actionCount >= 3 ? 'var(--high-border)' : 'var(--border-subtle)'),
                  }}
                >
                  {user.actionCount}x
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Total flagged: {users.reduce((sum, u) => sum + u.actionCount, 0)}
        </span>
        {users.filter((u) => u.actionCount >= 5).length > 0 && (
          <span className="badge badge-danger" style={{ fontSize: 9 }}>
            {users.filter((u) => u.actionCount >= 5).length} repeat offender{users.filter((u) => u.actionCount >= 5).length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
});
