interface ConfirmDialogProps {
  title: string;
  message: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const accentColor = danger ? 'var(--critical)' : 'var(--accent)';
  const accentBg = danger ? 'var(--critical-bg)' : 'var(--accent-muted)';
  const accentBorder = danger ? 'var(--critical-border)' : 'var(--accent-border)';

  return (
    <div className="overlay">
      <div className="overlay-backdrop" onClick={onCancel} />
      <div
        className="overlay-content animate-fade-in-scale"
        style={{ maxWidth: 380, padding: 'var(--space-6)' }}
      >
        {danger && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-lg)',
              background: accentBg,
              border: '1px solid ' + accentBorder,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-4)',
              boxShadow: '0 0 20px ' + accentBg,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        )}

        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{title}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-2)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{message}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span className="animate-spin" style={{ display: 'inline-flex' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                </span>
                Working...
              </span>
            ) : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
