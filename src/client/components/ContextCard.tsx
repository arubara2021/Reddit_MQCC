// src/client/components/ContextCard.tsx
import { memo } from 'react';
import type { UserContext } from '../../shared/api';

interface ContextCardProps {
  context: UserContext;
}

export const ContextCard = memo(function ContextCard({ context }: ContextCardProps) {
  const badges: Array<{ label: string; type: 'danger' | 'warn' | 'info' }> = [];

  if (context.isSuspended) badges.push({ label: 'Suspended', type: 'danger' });
  if (context.isShadowbanned) badges.push({ label: 'Shadowbanned', type: 'danger' });
  if (context.accountAgeDays >= 0 && context.accountAgeDays < 7) badges.push({ label: 'New account', type: 'warn' });
  if (context.totalKarma >= 0 && context.totalKarma < 10) badges.push({ label: 'Low karma', type: 'warn' });
  if (context.previousActionCount > 0) badges.push({ label: context.previousActionCount + ' prior action' + (context.previousActionCount !== 1 ? 's' : ''), type: 'info' });
  if (context.queueAppearances >= 3) badges.push({ label: 'Repeated (' + context.queueAppearances + 'x)', type: 'info' });

  const pillClass = (type: 'danger' | 'warn' | 'info') => {
    return 'pill pill-' + type;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      {context.accountAgeDays >= 0 ? (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          {context.accountAgeDays}d
        </span>
      ) : (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Age: --</span>
      )}

      <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>|</span>

      {context.totalKarma >= 0 ? (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          {context.totalKarma} karma
        </span>
      ) : (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Karma: --</span>
      )}

      {badges.map((badge, idx) => (
        <span key={idx} className={pillClass(badge.type)}>
          {badge.label}
        </span>
      ))}
    </div>
  );
});
