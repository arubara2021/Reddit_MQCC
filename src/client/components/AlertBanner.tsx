import { useState } from 'react';
import type { Anomaly } from '../../shared/api';

interface AlertBannerProps {
  anomalies: Anomaly[];
}

export function AlertBanner({ anomalies }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (anomalies.length === 0 || dismissed) return null;

  const top = anomalies[0];

  const borderColor =
    top.severity === 'critical'
      ? 'var(--critical)'
      : top.severity === 'high'
      ? 'var(--high)'
      : 'var(--medium)';

  const bgColor =
    top.severity === 'critical'
      ? 'var(--critical-bg)'
      : top.severity === 'high'
      ? 'var(--high-bg)'
      : 'var(--medium-bg)';

  const glowColor =
    top.severity === 'critical'
      ? 'rgba(244, 63, 94, 0.08)'
      : top.severity === 'high'
      ? 'rgba(245, 158, 11, 0.08)'
      : 'rgba(234, 179, 8, 0.08)';

  return (
    <div
      className="animate-fade-in"
      style={{
        background: bgColor,
        border: '1px solid ' + borderColor,
        borderLeft: '3px solid ' + borderColor,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        boxShadow: '0 0 20px ' + glowColor,
        transition: 'all var(--duration-normal) ease',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-md)',
          background: glowColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className={'badge badge-' + top.severity}>{top.severity.toUpperCase()}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{top.title}</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 'var(--space-1)', lineHeight: 1.5 }}>{top.description}</p>
        {anomalies.length > 1 && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'var(--space-1)', fontFamily: 'var(--font-mono)' }}>+{anomalies.length - 1} more alert{anomalies.length - 1 !== 1 ? 's' : ''}</p>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        style={{
          width: 26,
          height: 26,
          borderRadius: 'var(--radius-sm)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          flexShrink: 0,
          transition: 'all var(--duration-fast) ease',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
