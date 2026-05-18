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
        background: 'linear-gradient(135deg, #0b1120 0%, #111d35 50%, #0f172a 100%)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid rgba(240,180,41,0.15)',
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
          background: 'radial-gradient(circle, rgba(240,180,41,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #f0b429 0%, #e09100 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 16px rgba(240,180,41,0.3)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f0b429', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
          Community Pulse
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#eef0f6', lineHeight: 1.2 }}>
          {loaded ? 'r/' + subName : 'Loading...'}
        </div>
        <div style={{ fontSize: 12, color: '#8b92a5', marginTop: 4 }}>
          Tap to explore leaderboard
        </div>
      </div>

      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b92a5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
