// src/client/components/ErrorBanner.tsx
import { memo } from 'react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner = memo(function ErrorBanner({
  message,
  onRetry,
}: ErrorBannerProps) {
  return (
    <div
      className="animate-fade-in"
      style={{
        background: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        borderLeft: '3px solid var(--danger)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--danger)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>

        <p
          style={{
            fontSize: 12,
            color: 'var(--danger)',
            fontWeight: 500,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {message}
        </p>
      </div>

      {onRetry && (
        <button
          className="btn-ghost"
          onClick={onRetry}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            flexShrink: 0,
            borderColor: 'var(--danger-border)',
            color: 'var(--danger)',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
});
