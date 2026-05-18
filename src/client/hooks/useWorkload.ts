// src/client/hooks/useWorkload.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface WorkloadData {
  actionsByMod: Record<string, number>;
  actionsByType: Record<string, number>;
  actionsByHour: Record<string, number>;
  actionsByDay: Record<string, number>;
  recentActions: Array<{
    action: string;
    targetAuthor: string;
    targetId: string;
    reason: string | null;
    modName: string;
    timestamp: number;
  }>;
  totalActions: number;
  coverageGaps: Array<{
    day: string;
    hour: number;
    actionCount: number;
  }>;
  topFlaggedUsers: Array<{
    username: string;
    actionCount: number;
    lastAction: string;
  }>;
}

interface WorkloadState {
  workload: WorkloadData | null;
  loading: boolean;
  error: string | null;
}

export function useWorkload() {
  const [state, setState] = useState<WorkloadState>({
    workload: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const fetchWorkload = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch('/api/workload');

      if (!res.ok) {
        throw new Error('Failed to fetch workload');
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setState({
        workload: data.workload || null,
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
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchWorkload();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchWorkload]);

  return {
    ...state,
    refresh: fetchWorkload,
  };
}
