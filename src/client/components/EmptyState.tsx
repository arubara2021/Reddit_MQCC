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
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-xl)',
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
          boxShadow: '0 0 24px rgba(16, 185, 129, 0.08)',
          position: 'relative',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--success)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--success)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            marginTop: 1,
          }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-2)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          maxWidth: 280,
          margin: '0 auto',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </div>
  );
});
