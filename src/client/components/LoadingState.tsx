// src/client/components/LoadingState.tsx
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
        padding: '48px var(--space-6)',
        gap: 'var(--space-4)',
      }}
    >
      <div
        className="spinner"
        style={{
          width: 24,
          height: 24,
        }}
      />
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontWeight: 500,
        }}
      >
        {message || 'Loading...'}
      </p>
    </div>
  );
});
