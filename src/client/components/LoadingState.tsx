import { memo } from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState = memo(function LoadingState({
  message,
}: LoadingStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px var(--space-4)',
        gap: 'var(--space-4)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', maxWidth: 320 }}>
        <div className="skeleton-row">
          <div className="skeleton skeleton-dot" />
          <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          <div className="skeleton skeleton-badge" style={{ marginLeft: 'auto' }} />
        </div>
        <div className="skeleton-row">
          <div className="skeleton skeleton-dot" />
          <div className="skeleton skeleton-text" style={{ width: '75%' }} />
          <div className="skeleton skeleton-badge" style={{ marginLeft: 'auto' }} />
        </div>
        <div className="skeleton-row">
          <div className="skeleton skeleton-dot" />
          <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          <div className="skeleton skeleton-badge" style={{ marginLeft: 'auto' }} />
        </div>
      </div>
      <p
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
          marginTop: 'var(--space-2)',
        }}
      >
        {message || 'Loading...'}
      </p>
    </div>
  );
});
