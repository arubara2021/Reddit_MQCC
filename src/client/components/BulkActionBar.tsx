import { memo } from 'react';

interface BulkActionBarProps {
  selectedCount: number;
  banDuration: number;
  onBanDurationChange: (d: number) => void;
  onAction: (action: string) => void;
  onDeselectAll: () => void;
  loading: boolean;
}

export const BulkActionBar = memo(function BulkActionBar({
  selectedCount,
  banDuration,
  onBanDurationChange,
  onAction,
  onDeselectAll,
  loading,
}: BulkActionBarProps) {
  return (
    <div className="sticky-bottom">
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{selectedCount}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>selected</span>
          </div>
          <button
            onClick={onDeselectAll}
            style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear
          </button>

          <select
            value={banDuration}
            onChange={(e) => onBanDurationChange(Number(e.target.value))}
            style={{ fontSize: 11, padding: '3px 24px 3px 6px', background: 'var(--bg-base)' }}
          >
            <option value={0}>Permanent</option>
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          <button className="btn-approve" onClick={() => onAction('approve')} disabled={loading} style={{ fontSize: 10, padding: '5px 12px' }}>
            Approve
          </button>
          <button className="btn-ghost" onClick={() => onAction('remove')} disabled={loading} style={{ fontSize: 10, padding: '5px 12px' }}>
            Remove
          </button>
          <button className="btn-danger" onClick={() => onAction('ban')} disabled={loading} style={{ fontSize: 10, padding: '5px 12px' }}>
            Ban
          </button>
          <button
            className="btn-danger"
            onClick={() => onAction('removeAndBan')}
            disabled={loading}
            style={{ fontSize: 10, padding: '5px 12px', background: '#991b1b' }}
          >
            R+B
          </button>
        </div>
      </div>
    </div>
  );
});
