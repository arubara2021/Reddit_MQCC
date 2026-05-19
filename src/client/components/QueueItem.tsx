import { memo } from 'react';
import type { EnrichedQueueItem } from '../../shared/api';
import { ContextCard } from './ContextCard';

interface QueueItemProps {
  item: EnrichedQueueItem;
  selected: boolean;
  compact: boolean;
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

  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

export const QueueItem = memo(function QueueItem({
  item,
  selected,
  compact,
  onToggleSelect,
  onAction,
  onViewDetail,
}: QueueItemProps) {
  const contentPreview =
    item.type === 'post'
      ? item.title || truncate(item.body, 80)
      : truncate(item.body, 100);

  return (
    <div
      className={'queue-row' + (selected ? ' selected' : '')}
      style={{
        padding: compact ? 'var(--space-2) var(--space-3)' : 'var(--space-3) var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <button
          className={'checkbox' + (selected ? ' checked' : '')}
          onClick={() => onToggleSelect(item.id)}
          aria-label={selected ? 'Deselect' : 'Select'}
          style={{ marginTop: 3 }}
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
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              {item.type === 'post' ? 'POST' : 'COMMENT'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>|</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              u/{item.authorName}
            </span>
            <span style={{ fontSize: 10, color: 'var(--border-strong)' }}>|</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {item.reportCount}r
            </span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color:
                item.priority.level === 'critical' ? 'var(--critical)' :
                item.priority.level === 'high' ? 'var(--high)' :
                item.priority.level === 'medium' ? 'var(--medium)' :
                'var(--text-muted)',
            }}>
              {item.priority.score}
            </span>
          </div>

          <button
            onClick={() => onViewDetail(item)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              fontSize: compact ? 12 : 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {contentPreview || '(no content)'}
          </button>

          {item.reportReasons.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
              {item.reportReasons.slice(0, 2).map((reason, idx) => (
                <span key={idx} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>
                  {truncate(reason, 25)}
                </span>
              ))}
              {item.reportReasons.length > 2 && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{item.reportReasons.length - 2}</span>
              )}
            </div>
          )}

          {!compact && (
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
          </div>
        </div>
      </div>
    </div>
  );
});
