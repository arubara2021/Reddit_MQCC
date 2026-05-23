import { useState } from 'react';
import type { EnrichedQueueItem } from '../../shared/api';
import { ContextCard } from './ContextCard';
import { timeAgo } from '../utils/time';

interface DetailModalProps {
  item: EnrichedQueueItem;
  banDuration: number;
  onBanDurationChange: (d: number) => void;
  onClose: () => void;
  onAction: (id: string, action: string) => void;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{value}</p>
    </div>
  );
}

export function DetailModal({
  item,
  banDuration,
  onBanDurationChange,
  onClose,
  onAction,
}: DetailModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  const ageText = item.userContext.accountAgeDays >= 0 ? item.userContext.accountAgeDays + ' days' : 'Unknown';
  const karmaText = item.userContext.totalKarma >= 0 ? String(item.userContext.totalKarma) : 'Unknown';
  const postKarmaText = item.userContext.postKarma >= 0 ? String(item.userContext.postKarma) : 'Unknown';
  const commentKarmaText = item.userContext.commentKarma >= 0 ? String(item.userContext.commentKarma) : 'Unknown';

  const handleLinkClick = async () => {
    if (!item.permalink) return;
    const url = 'https://reddit.com' + item.permalink;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch {
        // silent
      }
    }
  };

  const severityColor =
    item.priority.level === 'critical' ? 'var(--critical)' :
    item.priority.level === 'high' ? 'var(--high)' :
    item.priority.level === 'medium' ? 'var(--medium)' :
    'var(--low)';

  return (
    <div className="overlay">
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="overlay-content animate-fade-in-scale">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className={'badge badge-' + item.priority.level}>
              {item.priority.level === 'critical' ? '!! ' : ''}{item.priority.level.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: severityColor, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Score: {item.priority.score}</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Content</p>
            {item.title && <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{item.title}</p>}
            {item.body && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: item.title ? 'var(--space-1)' : 0 }}>{item.body}</p>}
            {!item.title && !item.body && <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No content available</p>}
          </div>

          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Author</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>u/{item.authorName}</span>
              <span className="pill">{item.type}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(item.createdAt)}</span>
            </div>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ContextCard context={item.userContext} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>User Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
              <DetailField label="Account age" value={ageText} />
              <DetailField label="Total karma" value={karmaText} />
              <DetailField label="Post karma" value={postKarmaText} />
              <DetailField label="Comment karma" value={commentKarmaText} />
              <DetailField label="Queue appearances" value={String(item.userContext.queueAppearances)} />
              <DetailField label="Prior actions" value={String(item.userContext.previousActionCount)} />
              {item.userContext.lastActionType && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <DetailField
                    label="Last action"
                    value={item.userContext.lastActionType + ' (' + new Date(item.userContext.lastActionTimestamp).toLocaleDateString() + ')'}
                  />
                </div>
              )}
            </div>
          </div>

          {item.reportReasons.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                Reports ({item.reportCount})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {item.reportReasons.map((reason, idx) => (
                  <span key={idx} className="pill">{reason}</span>
                ))}
              </div>
            </div>
          )}

          {item.priority.factors.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Priority Factors</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {item.priority.factors.map((factor, idx) => (
                  <span key={idx} className="pill pill-warn">{factor}</span>
                ))}
              </div>
            </div>
          )}

          {item.permalink && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Link</p>
              <button
                onClick={handleLinkClick}
                style={{
                  fontSize: 11,
                  color: linkCopied ? 'var(--success)' : 'var(--accent)',
                  background: linkCopied ? 'var(--success-bg)' : 'var(--accent-muted)',
                  border: '1px solid ' + (linkCopied ? 'var(--success-border)' : 'var(--accent-border)'),
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-all',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  transition: 'all var(--duration-fast) ease',
                }}
              >
                {linkCopied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Link copied to clipboard
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    reddit.com{item.permalink}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-5)',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <select
            value={banDuration}
            onChange={(e) => onBanDurationChange(Number(e.target.value))}
            style={{ fontSize: 11, padding: '6px 28px 6px 10px' }}
          >
            <option value={0}>Permanent ban</option>
            <option value={1}>1 day ban</option>
            <option value={3}>3 day ban</option>
            <option value={7}>7 day ban</option>
            <option value={14}>14 day ban</option>
            <option value={30}>30 day ban</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn-approve" onClick={() => onAction(item.id, 'approve')}>Approve</button>
            <button className="btn-ghost" onClick={() => onAction(item.id, 'remove')}>Remove</button>
            <button className="btn-danger" onClick={() => onAction(item.id, 'ban')}>Ban</button>
          </div>
        </div>
      </div>
    </div>
  );
}
