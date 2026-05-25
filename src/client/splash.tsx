import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';

function Splash() {
  const [subName, setSubName] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/init')
      .then((r) => r.json())
      .then((data) => {
        setSubName(data.subredditName || 'community');
      })
      .catch(() => {
        setSubName('community');
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  return (
    <div
      style={{
        width: '100%',
        minHeight: 120,
        background: 'linear-gradient(135deg, var(--bg-base, #08090d) 0%, var(--bg-elevated, #0f1118) 50%, var(--bg-surface, #0b0d14) 100%)',
        borderRadius: 'var(--radius-xl, 12px)',
        padding: 'var(--space-5, 20px) var(--space-6, 24px)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4, 16px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid var(--info-border, rgba(59, 130, 246, 0.12))',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--info-bg, rgba(59, 130, 246, 0.08)) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-xl, 12px)',
          background: 'linear-gradient(135deg, #2563eb 0%, var(--info, #3b82f6) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info, #3b82f6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
          Community Pulse
        </div>
        <div style={{ fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)", fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #f1f5f9)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {loaded ? 'r/' + subName : 'Loading...'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #475569)', marginTop: 'var(--space-1, 4px)' }}>
          Tap to explore leaderboard
        </div>
      </div>

      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-lg, 8px)',
          background: 'var(--bg-hover, rgba(255,255,255,0.04))',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #475569)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Splash />);
}
