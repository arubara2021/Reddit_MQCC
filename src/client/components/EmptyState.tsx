// src/client/components/EmptyState.tsx
import { memo } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState = memo(function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div
      className="card animate-fade-in"
      style={{
        padding: '48px var(--space-6)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-xl)',
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--success)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          maxWidth: 260,
          margin: '0 auto',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </div>
  );
});
