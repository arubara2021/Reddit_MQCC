import type { EnrichedQueueItem, GroupedQueueItem } from '../../shared/api';
import { QueueItem } from './QueueItem';

interface PriorityQueueProps {
  items: EnrichedQueueItem[];
  groups: GroupedQueueItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onAction: (id: string, action: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onViewDetail: (item: EnrichedQueueItem) => void;
  compactMode: boolean;
}

const groupColors: Record<string, string> = {
  link_cluster: 'var(--info)',
  time_burst: 'var(--warning)',
  username_pattern: 'var(--accent)',
};

const groupLabels: Record<string, string> = {
  link_cluster: 'LINK CLUSTER',
  time_burst: 'TIME BURST',
  username_pattern: 'COORDINATED',
};

function truncateBody(text: string, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : text.substring(0, max - 3) + '...';
}

export function PriorityQueue({
  items,
  groups,
  selectedIds,
  onToggleSelect,
  onAction,
  onSelectAll,
  onDeselectAll,
  onViewDetail,
  compactMode,
}: PriorityQueueProps) {
  const groupedItemIds = new Set<string>();
  for (const group of groups) {
    for (const item of group.items) {
      groupedItemIds.add(item.id);
    }
  }

  const ungroupedItems = items.filter((item) => !groupedItemIds.has(item.id));
  const sorted = [...ungroupedItems].sort((a, b) => b.priority.score - a.priority.score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            onClick={onSelectAll}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Select all
          </button>
          <span style={{ fontSize: 10, color: 'var(--border-default)' }}>|</span>
          <button
            onClick={onDeselectAll}
            style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Deselect
          </button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.id} className="group-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: groupColors[group.groupType] || 'var(--accent)',
                background: 'var(--bg-hover)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {groupLabels[group.groupType] || 'GROUP'}
            </span>
            <span className={'badge badge-' + group.topPriority.level}>
              {group.topPriority.level.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {group.items.length} items
            </span>
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{group.label}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{group.description}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
            {group.authors.slice(0, 6).map((author, idx) => (
              <span key={idx} className="pill" style={{ fontSize: 10 }}>u/{author}</span>
            ))}
            {group.authors.length > 6 && (
              <span className="pill" style={{ fontSize: 10 }}>+{group.authors.length - 6}</span>
            )}
          </div>

          {group.domains.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
              {group.domains.map((domain, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--info)',
                    background: 'var(--info-bg)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {domain}
                </span>
              ))}
            </div>
          )}

          <details style={{ marginTop: 'var(--space-3)' }}>
            <summary style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              View {group.items.length} item{group.items.length !== 1 ? 's' : ''}
            </summary>
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: 200, overflowY: 'auto' }}>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    fontSize: 11,
                    background: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--border-subtle)',
                    gap: 'var(--space-2)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.type === 'post' ? item.title || truncateBody(item.body, 50) : truncateBody(item.body, 60)}
                  </span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    u/{item.authorName}
                  </span>
                </div>
              ))}
            </div>
          </details>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <button className="btn-ghost" onClick={() => onAction(group.items[0].id, 'remove')} style={{ fontSize: 11 }}>
              Remove All ({group.items.length})
            </button>
            <button className="btn-danger" onClick={() => onAction(group.items[0].id, 'ban')} style={{ fontSize: 11 }}>
              Ban All ({group.authors.length})
            </button>
          </div>
        </div>
      ))}

      {groups.length > 0 && sorted.length > 0 && (
        <div className="separator">
          <div className="separator-line" />
          <span className="separator-label">Individual Items</span>
          <div className="separator-line" />
        </div>
      )}

      {sorted.map((item) => (
        <QueueItem
          key={item.id}
          item={item}
          selected={selectedIds.has(item.id)}
          compact={compactMode}
          onToggleSelect={onToggleSelect}
          onAction={onAction}
          onViewDetail={onViewDetail}
        />
      ))}
    </div>
  );
}
