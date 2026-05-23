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
        padding: '56px var(--space-6)',
        gap: 'var(--space-4)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          boxShadow: '0 0 12px var(--accent-glow)',
        }}
      />
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em',
        }}
      >
        {message || 'Loading...'}
      </p>
    </div>
  );
});
