import { useState } from 'react';
import type { PatternResult } from '../../shared/api';

interface PatternAlertProps {
  patterns: PatternResult | null;
}

export function PatternAlert({ patterns }: PatternAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!patterns || dismissed) return null;

  const total = patterns.linkClusters.length + patterns.timeBursts.length + patterns.usernamePatterns.length;
  if (total === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', minWidth: 0, position: 'relative' }}>

      <button
        onClick={() => setDismissed(true)}
        style={{
          position: 'absolute',
          top: -4,
          right: -4,
          width: 20,
          height: 20,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-default)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          flexShrink: 0,
          zIndex: 2,
          transition: 'all var(--duration-fast) ease',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {patterns.linkClusters.map((cluster, idx) => (
        <div
          key={'lc-' + idx}
          style={{
            background: 'var(--info-bg)',
            border: '1px solid var(--info-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflow: 'hidden',
            transition: 'all var(--duration-normal) ease',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.1)',
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
              stroke="var(--info)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {cluster.uniqueAuthors.length} accounts sharing {cluster.domain}
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--info)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {cluster.count}x
          </span>
        </div>
      ))}

      {patterns.timeBursts.map((burst, idx) => (
        <div
          key={'tb-' + idx}
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflow: 'hidden',
            transition: 'all var(--duration-normal) ease',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(234, 179, 8, 0.1)',
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
              stroke="var(--warning)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {burst.count} items in {burst.windowHours}h, {burst.newAccountCount} new accounts
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--warning)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              background: 'rgba(234, 179, 8, 0.1)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {burst.count}x
          </span>
        </div>
      ))}

      {patterns.usernamePatterns.map((pattern, idx) => (
        <div
          key={'up-' + idx}
          style={{
            background: 'var(--accent-muted)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflow: 'hidden',
            transition: 'all var(--duration-normal) ease',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.1)',
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
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pattern.accounts.length} accounts matching &quot;{pattern.pattern}&quot;
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              background: 'var(--accent-muted)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {pattern.accounts.length}x
          </span>
        </div>
      ))}
    </div>
  );
}
