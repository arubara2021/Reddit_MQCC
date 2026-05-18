import { useState, useCallback, useMemo, useEffect } from 'react';
import type { EnrichedQueueItem, Anomaly, PatternResult } from '../../shared/api';
import { useQueue } from '../hooks/useQueue';
import { useSettings } from '../hooks/useSettings';
import { PriorityQueue } from './PriorityQueue';
import { BulkActionBar } from './BulkActionBar';
import { AlertBanner } from './AlertBanner';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { ConfirmDialog } from './ConfirmDialog';
import { DetailModal } from './DetailModal';
import { WorkloadTab } from './WorkloadTab';
import { PatternAlert } from './PatternAlert';
import { PublicDashboard } from './PublicDashboard';

type TabId = 'queue' | 'workload' | 'alerts' | 'settings';
type FilterId = 'all' | 'posts' | 'comments' | 'critical' | 'high';

export function Dashboard() {
  const [isMod, setIsMod] = useState(false);
  const [subredditName, setSubredditName] = useState('unknown');
  const [initDone, setInitDone] = useState(false);

  const { settings, updateSettings } = useSettings();
  const { items, groups, lastUpdated, loading, error, refresh } = useQueue(
    isMod && settings.autoRefresh,
    settings.refreshIntervalMs
  );

  const [activeTab, setActiveTab] = useState<TabId>('queue');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<EnrichedQueueItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [patterns, setPatterns] = useState<PatternResult | null>(null);
  const [banDuration, setBanDuration] = useState<number>(0);

  useEffect(() => {
    fetch('/api/init')
      .then((r) => r.json())
      .then((data) => {
        setSubredditName(data.subredditName || 'unknown');
        setIsMod(data.isMod === true && data.verified === true);
      })
      .catch(() => {
        setIsMod(false);
      })
      .finally(() => {
        setInitDone(true);
      });
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (!isMod) return;
    Promise.allSettled([
      fetch('/api/anomalies').then((r) => r.json()),
      fetch('/api/patterns').then((r) => r.json()),
    ]).then(([anomaliesRes, patternsRes]) => {
      if (anomaliesRes.status === 'fulfilled') setAnomalies(anomaliesRes.value.anomalies || []);
      if (patternsRes.status === 'fulfilled') setPatterns(patternsRes.value.patterns || null);
    });
  }, [isMod]);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case 'posts': return items.filter((i) => i.type === 'post');
      case 'comments': return items.filter((i) => i.type === 'comment');
      case 'critical': return items.filter((i) => i.priority.level === 'critical');
      case 'high': return items.filter((i) => i.priority.level === 'high');
      default: return items;
    }
  }, [items, activeFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    critical: items.filter((i) => i.priority.level === 'critical').length,
    high: items.filter((i) => i.priority.level === 'high').length,
    posts: items.filter((i) => i.type === 'post').length,
    comments: items.filter((i) => i.type === 'comment').length,
  }), [items]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(filteredItems.map((i) => i.id))), [filteredItems]);
  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);
  const getSelectedItems = useCallback(() => items.filter((i) => selectedIds.has(i.id)), [items, selectedIds]);

  const executeSingleAction = useCallback(async (id: string, action: string) => {
    setActionLoading(true);
    try {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const endpoint = '/api/action/' + action;
      let body: Record<string, unknown>;
      if (action === 'ban') {
        body = { username: item.authorName, reason: 'Actioned via MQCC', durationDays: banDuration };
      } else if (action === 'removeAndBan') {
        body = { fullname: item.fullname, username: item.authorName, reason: 'Actioned via MQCC', durationDays: banDuration };
      } else {
        body = { fullname: item.fullname, authorName: item.authorName };
      }

      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || action + ' succeeded', 'success');
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        setTimeout(refresh, 500);
      } else {
        showToast(data.message || action + ' failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }, [items, banDuration, showToast, refresh]);

  const handleSingleAction = useCallback((id: string, action: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (action === 'ban' || action === 'removeAndBan') {
      setConfirmAction({
        title: action === 'ban' ? 'Ban u/' + item.authorName : 'Remove & Ban u/' + item.authorName,
        message: action === 'ban' ? 'This will permanently ban u/' + item.authorName + ' from the subreddit.' : 'This will remove the content and ban u/' + item.authorName + '.',
        danger: true,
        onConfirm: () => executeSingleAction(id, action),
      });
      return;
    }
    executeSingleAction(id, action);
  }, [items, executeSingleAction]);

  const executeBulkAction = useCallback(async (action: string) => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/action/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, items: selected, durationDays: banDuration, reason: 'Bulk action via MQCC' }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        const r = data.result;
        showToast(r.success + ' succeeded' + (r.failed > 0 ? ', ' + r.failed + ' failed' : ''), r.failed > 0 ? 'error' : 'success');
        deselectAll();
        setTimeout(refresh, 500);
      } else {
        showToast(data.message || 'Bulk action failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Bulk action failed', 'error');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }, [getSelectedItems, banDuration, showToast, deselectAll, refresh]);

  const handleBulkAction = useCallback((action: string) => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;
    if (action === 'ban' || action === 'removeAndBan') {
      const authors = [...new Set(selected.map((i) => i.authorName))];
      setConfirmAction({
        title: action === 'ban' ? 'Ban ' + selected.length + ' items' : 'Remove & Ban ' + selected.length + ' items',
        message: 'Affected users: ' + authors.slice(0, 5).join(', ') + (authors.length > 5 ? ' and ' + (authors.length - 5) + ' more' : ''),
        danger: true,
        onConfirm: () => executeBulkAction(action),
      });
      return;
    }
    executeBulkAction(action);
  }, [getSelectedItems, executeBulkAction]);

  const handleSeed = useCallback(async () => {
    try {
      showToast('Generating test data...', 'info');
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Seeded ' + data.data.actions + ' actions, ' + data.data.queueItems + ' items', 'success');
        setTimeout(refresh, 1000);
      } else {
        showToast(data.error || 'Seed failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Seed failed', 'error');
    }
  }, [showToast, refresh]);

  const handleSeedClear = useCallback(async () => {
    try {
      showToast('Clearing test data...', 'info');
      const res = await fetch('/api/seed/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Test data cleared', 'success');
        setTimeout(refresh, 1000);
      } else {
        showToast(data.error || 'Clear failed', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Clear failed', 'error');
    }
  }, [showToast, refresh]);

  const selectedCount = selectedIds.size;

  if (!initDone) {
    return (
      <div className="mod-root mod-loading">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  if (!isMod) {
    return <PublicDashboard subredditName={subredditName} />;
  }

  return (
    <div className="mod-root">
      <div className="mod-header-sticky">
        <div className="mod-container">
          <div className="mod-header-row">
            <div className="mod-brand">
              <div className="mod-brand-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h1 className="mod-brand-title">MQCC</h1>
                <span className="mod-brand-subtitle">Mod Queue Command Center</span>
              </div>
            </div>
            <div className="mod-header-actions">
              <button
                className="btn-icon"
                onClick={() => updateSettings({ autoRefresh: !settings.autoRefresh })}
                title={settings.autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                style={{ color: settings.autoRefresh ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  {settings.autoRefresh && <circle cx="12" cy="12" r="3" fill="currentColor" />}
                </svg>
              </button>
              <button className="btn-ghost mod-refresh-btn" onClick={refresh} disabled={loading}>
                <span className={loading ? 'animate-spin' : ''} style={{ display: 'inline-flex' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </span>
                <span className="mod-refresh-label">Refresh</span>
              </button>
            </div>
          </div>

          <div className="mod-stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Queue</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: stats.critical > 0 ? 'var(--critical)' : 'var(--text-muted)' }}>{stats.critical}</div>
              <div className="stat-label">Critical</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: stats.high > 0 ? 'var(--high)' : 'var(--text-muted)' }}>{stats.high}</div>
              <div className="stat-label">High</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{stats.posts}/{stats.comments}</div>
              <div className="stat-label">P/C</div>
            </div>
          </div>

          <div className="tab-nav">
            {(['queue', 'workload', 'alerts', 'settings'] as TabId[]).map((tab) => (
              <button
                key={tab}
                className={'tab-btn' + (activeTab === tab ? ' active' : '')}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'queue' ? 'Queue (' + stats.total + ')' : tab === 'workload' ? 'Workload' : tab === 'alerts' ? 'Alerts (' + anomalies.length + ')' : 'Settings'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mod-container mod-content">
        {activeTab === 'queue' && (
          <div className="animate-fade-in">
            {patterns && <PatternAlert patterns={patterns} />}

            <div className="filter-bar mod-filter-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {([
                { id: 'all' as FilterId, label: 'All' },
                { id: 'posts' as FilterId, label: 'Posts (' + stats.posts + ')' },
                { id: 'comments' as FilterId, label: 'Comments (' + stats.comments + ')' },
                { id: 'critical' as FilterId, label: 'Critical' },
                { id: 'high' as FilterId, label: 'High' },
              ]).map((f) => (
                <button
                  key={f.id}
                  className={'filter-chip' + (activeFilter === f.id ? ' active' : '')}
                  onClick={() => setActiveFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mod-error-banner">
                <p className="mod-error-text">{error}</p>
              </div>
            )}

            {anomalies.length > 0 && <AlertBanner anomalies={anomalies} />}

            {loading && items.length === 0 ? (
              <LoadingState message="Loading queue..." />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title="Queue is clear"
                description={activeFilter === 'all' ? 'No reported items. Good work.' : 'No items match this filter.'}
              />
            ) : (
              <PriorityQueue
                items={filteredItems}
                groups={groups}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onAction={handleSingleAction}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onViewDetail={setDetailItem}
                compactMode={settings.compactMode}
              />
            )}

            {selectedCount > 0 && (
              <BulkActionBar
                selectedCount={selectedCount}
                banDuration={banDuration}
                onBanDurationChange={setBanDuration}
                onAction={handleBulkAction}
                onDeselectAll={deselectAll}
                loading={actionLoading}
              />
            )}
          </div>
        )}

        {activeTab === 'workload' && (
          <div className="animate-fade-in">
            <WorkloadTab />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="animate-fade-in mod-alerts-list">
            {anomalies.length === 0 ? (
              <EmptyState title="No active alerts" description="Everything looks normal right now." />
            ) : (
              anomalies.map((a) => (
                <div
                  key={a.id}
                  className="card mod-alert-card"
                  style={{ borderLeftColor: a.severity === 'critical' ? 'var(--critical)' : a.severity === 'high' ? 'var(--high)' : 'var(--medium)' }}
                >
                  <div className="mod-alert-header">
                    <span className={'badge badge-' + a.severity}>{a.severity.toUpperCase()}</span>
                    <span className="mod-alert-title">{a.title}</span>
                  </div>
                  <p className="mod-alert-desc">{a.description}</p>
                  {a.affectedAuthors.length > 0 && (
                    <div className="mod-alert-authors">
                      {a.affectedAuthors.slice(0, 8).map((author, i) => (
                        <span key={i} className="pill">u/{author}</span>
                      ))}
                      {a.affectedAuthors.length > 8 && (
                        <span className="pill">+{a.affectedAuthors.length - 8}</span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fade-in mod-settings-list">
            <div className="card mod-settings-card">
              <h3 className="mod-settings-heading">Refresh</h3>
              <div className="mod-settings-row">
                <span className="mod-settings-label">Auto-refresh</span>
                <button
                  className={settings.autoRefresh ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '4px 12px', fontSize: 11 }}
                  onClick={() => updateSettings({ autoRefresh: !settings.autoRefresh })}
                >
                  {settings.autoRefresh ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="mod-settings-row">
                <span className="mod-settings-label">Interval</span>
                <select
                  value={settings.refreshIntervalMs}
                  onChange={(e) => updateSettings({ refreshIntervalMs: Number(e.target.value) })}
                  className="mod-settings-select"
                >
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={120000}>2 minutes</option>
                  <option value={300000}>5 minutes</option>
                </select>
              </div>
            </div>

            <div className="card mod-settings-card">
              <h3 className="mod-settings-heading">Display</h3>
              <div className="mod-settings-row">
                <span className="mod-settings-label">Compact mode</span>
                <button
                  className={settings.compactMode ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '4px 12px', fontSize: 11 }}
                  onClick={() => updateSettings({ compactMode: !settings.compactMode })}
                >
                  {settings.compactMode ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="mod-settings-row">
                <span className="mod-settings-label">Group spam rings</span>
                <button
                  className={settings.groupSpamRings ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '4px 12px', fontSize: 11 }}
                  onClick={() => updateSettings({ groupSpamRings: !settings.groupSpamRings })}
                >
                  {settings.groupSpamRings ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div className="card mod-settings-card">
              <h3 className="mod-settings-heading">Alerts</h3>
              <div className="mod-settings-row">
                <span className="mod-settings-label">Enable anomaly alerts</span>
                <button
                  className={settings.enableAlerts ? 'btn-primary' : 'btn-ghost'}
                  style={{ padding: '4px 12px', fontSize: 11 }}
                  onClick={() => updateSettings({ enableAlerts: !settings.enableAlerts })}
                >
                  {settings.enableAlerts ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div className="card mod-settings-card">
              <h3 className="mod-settings-heading">Test Data</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Generate sample data to test all dashboard features.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '4px 12px', fontSize: 11 }}
                  onClick={handleSeed}
                >
                  Generate Test Data
                </button>
                <button
                  className="btn-ghost"
                  style={{ padding: '4px 12px', fontSize: 11 }}
                  onClick={handleSeedClear}
                >
                  Clear Test Data
                </button>
              </div>
            </div>

            {lastUpdated > 0 && (
              <p className="mod-last-updated">
                Last updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago
              </p>
            )}
          </div>
        )}
      </div>

      {detailItem && (
        <DetailModal
          item={detailItem}
          banDuration={banDuration}
          onBanDurationChange={setBanDuration}
          onClose={() => setDetailItem(null)}
          onAction={(id, action) => { handleSingleAction(id, action); setDetailItem(null); }}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          danger={confirmAction.danger}
          loading={actionLoading}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {toast && (
        <div className={'toast-enter mod-toast mod-toast-' + toast.type}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
