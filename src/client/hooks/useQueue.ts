// src/client/hooks/useQueue.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { EnrichedQueueItem, GroupedQueueItem } from '../../shared/api';

interface QueueState {
  items: EnrichedQueueItem[];
  groups: GroupedQueueItem[];
  lastUpdated: number;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: QueueState = {
  items: [],
  groups: [],
  lastUpdated: 0,
  loading: true,
  error: null,
};

export function useQueue(autoRefresh: boolean, intervalMs: number) {
  const [state, setState] = useState<QueueState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch('/api/queue');

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as any).message || 'Failed to fetch queue'
        );
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setState({
        items: data.items || [],
        groups: data.groups || [],
        lastUpdated: data.lastUpdated || Date.now(),
        loading: false,
        error: null,
      });
    } catch (e) {
      if (!mountedRef.current) return;

      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      }));
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchQueue();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchQueue]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const clampedInterval = Math.max(10000, Math.min(intervalMs, 300000));
    const timer = setInterval(fetchQueue, clampedInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, intervalMs, fetchQueue]);

  const refresh = useCallback(() => {
    fetchQueue();
  }, [fetchQueue]);

  return {
    ...state,
    refresh,
  };
}
