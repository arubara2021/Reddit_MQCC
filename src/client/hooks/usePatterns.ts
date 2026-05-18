// src/client/hooks/usePatterns.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { PatternResult } from '../../shared/api';

interface PatternsState {
  patterns: PatternResult | null;
  loading: boolean;
  error: string | null;
}

export function usePatterns() {
  const [state, setState] = useState<PatternsState>({
    patterns: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const fetchPatterns = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch('/api/patterns');

      if (!res.ok) {
        throw new Error('Failed to fetch patterns');
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setState({
        patterns: data.patterns || null,
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
    fetchPatterns();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPatterns]);

  return {
    ...state,
    refresh: fetchPatterns,
  };
}
