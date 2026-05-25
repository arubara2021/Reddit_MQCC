import { useState, useEffect, useCallback, useRef } from 'react';
import type { EnrichedQueueItem, GroupedQueueItem, Anomaly, PatternResult } from '../../shared/api';

const FETCH_TIMEOUT_MS = 10000;

interface QueueState {
  items: EnrichedQueueItem[];
  groups: GroupedQueueItem[];
  lastUpdated: number;
  loading: boolean;
  error: string | null;
  anomalies: Anomaly[];
  patterns: PatternResult | null;
  connectionStatus: 'connected' | 'slow' | 'disconnected';
}

const INITIAL_STATE: QueueState = {
  items: [],
  groups: [],
  lastUpdated: 0,
  loading: true,
  error: null,
  anomalies: [],
  patterns: null,
  connectionStatus: 'connected',
};

export function useQueue(autoRefresh: boolean, intervalMs: number) {
  const [state, setState] = useState<QueueState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successCountRef = useRef(0);

  const fetchQueue = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      slowTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setState((prev) =>
            prev.loading ? { ...prev, connectionStatus: 'slow' } : prev
          );
        }
      }, 5000);

      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch('/api/queue', { signal: controller.signal });

      clearTimeout(timeoutId);

      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as Record<string, string>).message || 'Failed to fetch queue'
        );
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      successCountRef.current++;

      setState({
        items: data.items || [],
        groups: data.groups || [],
        lastUpdated: data.lastUpdated || Date.now(),
        loading: false,
        error: null,
        anomalies: data.anomalies || [],
        patterns: data.patterns || null,
        connectionStatus: 'connected',
      });
    } catch (e) {
      if (!mountedRef.current) return;

      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }

      if (e instanceof DOMException && e.name === 'AbortError') {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Request timed out. The server may be slow.',
          connectionStatus: 'disconnected',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          connectionStatus:
            successCountRef.current > 0
              ? prev.connectionStatus
              : 'disconnected',
        }));
      }
    } finally {
      fetchingRef.current = false;
      abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchQueue();

    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
      }
    };
  }, [fetchQueue]);

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
