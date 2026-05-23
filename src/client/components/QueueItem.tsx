import { memo } from 'react';
import type { EnrichedQueueItem } from '../../shared/api';
import { ContextCard } from './ContextCard';
import { timeAgo } from '../utils/time';

interface QueueItemProps {
  item: EnrichedQueueItem;
  selected: boolean;
  compact: boolean;
  handledAction?: string | null;
  onToggleSelect: (id: string) => void;
  onAction: (id: string, action: string) => void;
  onViewDetail: (item: EnrichedQueueItem) => void;
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : text.substring(0, max - 3) + '...';
}

function PriorityDot({ level }: { level: string }) {
  const color =
    level === 'critical' ? 'var(--critical)' :
    level === 'high' ? 'var(--high)' :
    level === 'medium' ? 'var(--medium)' :
    'var(--low)';

  const isCritical = level === 'critical';

  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
        boxShadow: isCritical ? '0 0 6px ' + color : 'none',
        animation: isCritical ? 'pulseGlow 2s ease infinite' : 'none',
      }}
    />
  );
}

function HandledBadge({ action }: { action: string }) {
  const config: Record<string, { bg: string; border: string; color: string; label: string }> = {
    approve: { bg: 'var(--success-bg)', border: 'var(--success-border)', color: 'var(--success)', label: 'Approved' },
    remove: { bg: 'var(--critical-bg)', border: 'var(--critical-border)', color: 'var(--critical)', label: 'Removed' },
    ban: { bg: 'var(--high-bg)', border: 'var(--high-border)', color: 'var(--high)', label: 'Banned' },
    'remove+ban': { bg: 'var(--critical-bg)', border: 'var(--critical-border)', color: 'var(--critical)', label: 'Removed + Banned' },
  };
  const c = config[action] || config.remove;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 9,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: c.color,
        background: c.bg,
        border: '1px solid ' + c.border,
        borderRadius: 'var(--radius-sm)',
        padding: '2px 8px',
        flexShrink: 0,
      }}
    >
      {c.label}
    </span>
  );
}

export const QueueItem = memo(function QueueItem({
  item,
  selected,
  compact,
  handledAction,
  onToggleSelect,
  onAction,
  onViewDetail,
}: QueueItemProps) {
  const isHandled = !!handledAction;

  const contentPreview =
    item.type === 'post'
      ? item.title || truncate(item.body, 80)
      : truncate(item.body, 100);

  const borderColor =
    item.priority.level === 'critical' ? 'var(--critical)' :
    item.priority.level === 'high' ? 'var(--high)' :
    item.priority.level === 'medium' ? 'var(--medium)' :
    'var(--border-subtle)';

  const scoreColor =
    item.priority.level === 'critical' ? 'var(--critical)' :
    item.priority.level === 'high' ? 'var(--high)' :
    item.priority.level === 'medium' ? 'var(--medium)' :
    'var(--text-muted)';

  return (
    <div
      className={'queue-row' + (selected ? ' selected' : '')}
      style={{
        padding: compact ? 'var(--space-2) var(--space-3)' : 'var(--space-3) var(--space-4)',
        opacity: isHandled ? 0.5 : 1,
        transition: 'all 0.3s ease',
        position: 'relative',
        borderLeftColor: isHandled ? borderColor : borderColor,
      }}
    >
      {isHandled && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 3,
            height: '100%',
            borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
            background:
              handledAction === 'approve' ? 'var(--success)' :
              handledAction === 'ban' ? 'var(--high)' :
              'var(--critical)',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <button
          className={'checkbox' + (selected ? ' checked' : '')}
          onClick={() => onToggleSelect(item.id)}
          aria-label={selected ? 'Deselect' : 'Select'}
          style={{ marginTop: 3, visibility: isHandled ? 'hidden' : 'visible' }}
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <PriorityDot level={item.priority.level} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.type === 'post' ? 'POST' : 'COMMENT'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              u/{item.authorName}
            </span>
            <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {item.reportCount}r
            </span>
            <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {timeAgo(item.createdAt)}
            </span>

            {isHandled ? (
              <HandledBadge action={handledAction!} />
            ) : (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: scoreColor,
                }}
              >
                {item.priority.score}
              </span>
            )}
          </div>

          <button
            onClick={() => onViewDetail(item)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              fontSize: compact ? 12 : 13,
              fontWeight: 500,
              color: isHandled ? 'var(--text-muted)' : 'var(--text-primary)',
              lineHeight: 1.5,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: isHandled ? 'line-through' : 'none',
            }}
          >
            {contentPreview || '(no content)'}
          </button>

          {item.reportReasons.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
              {item.reportReasons.slice(0, 2).map((reason, idx) => (
                <span key={idx} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                  {truncate(reason, 25)}
                </span>
              ))}
              {item.reportReasons.length > 2 && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{item.reportReasons.length - 2}</span>
              )}
            </div>
          )}

          {!compact && !isHandled && (
            <div style={{ marginTop: 'var(--space-2)' }} className="hide-mobile">
              <ContextCard context={item.userContext} />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              marginTop: compact ? 'var(--space-2)' : 'var(--space-3)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {isHandled ? (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Action completed
              </span>
            ) : (
              <>
                <button
                  className="btn-approve"
                  onClick={() => onAction(item.id, 'approve')}
                  style={{ fontSize: 10, padding: '4px 10px' }}
                >
                  Approve
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => onAction(item.id, 'remove')}
                  style={{ fontSize: 10, padding: '4px 10px' }}
                >
                  Remove
                </button>
                <button
                  className="btn-danger"
                  onClick={() => onAction(item.id, 'ban')}
                  style={{ fontSize: 10, padding: '4px 10px' }}
                >
                  Ban
                </button>
                <button
                  className="btn-danger"
                  onClick={() => onAction(item.id, 'removeAndBan')}
                  style={{ fontSize: 10, padding: '4px 10px', background: '#881337' }}
                >
                  Spam
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
