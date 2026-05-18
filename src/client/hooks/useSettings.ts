// src/client/hooks/useSettings.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface AppSettings {
  priorityWeights: {
    reportCount: number;
    accountAge: number;
    karma: number;
    queueHistory: number;
    modHistory: number;
  };
  autoRefresh: boolean;
  refreshIntervalMs: number;
  groupSpamRings: boolean;
  enableAlerts: boolean;
  compactMode: boolean;
}

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  updating: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  priorityWeights: {
    reportCount: 0.3,
    accountAge: 0.25,
    karma: 0.2,
    queueHistory: 0.15,
    modHistory: 0.1,
  },
  autoRefresh: false,
  refreshIntervalMs: 30000,
  groupSpamRings: true,
  enableAlerts: true,
  compactMode: false,
};

export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    settings: null,
    loading: true,
    error: null,
    updating: false,
  });
  const mountedRef = useRef(true);

  const fetchSettings = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch('/api/settings');

      if (!res.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setState({
        settings: data.settings || DEFAULT_SETTINGS,
        loading: false,
        error: null,
        updating: false,
      });
    } catch (e) {
      if (!mountedRef.current) return;

      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        updating: false,
      }));
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      try {
        setState((prev) => ({ ...prev, updating: true, error: null }));

        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          throw new Error('Failed to update settings');
        }

        const data = await res.json();

        if (!mountedRef.current) return;

        setState((prev) => ({
          ...prev,
          settings: data.settings || prev.settings,
          updating: false,
        }));

        return data.settings;
      } catch (e) {
        if (!mountedRef.current) return;

        setState((prev) => ({
          ...prev,
          updating: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        }));

        return null;
      }
    },
    []
  );

  const resetSettings = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, updating: true, error: null }));

      const res = await fetch('/api/settings/reset', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to reset settings');
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      setState({
        settings: data.settings || DEFAULT_SETTINGS,
        loading: false,
        error: null,
        updating: false,
      });

      return data.settings;
    } catch (e) {
      if (!mountedRef.current) return;

      setState((prev) => ({
        ...prev,
        updating: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      }));

      return null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSettings();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchSettings]);

  return {
    settings: state.settings || DEFAULT_SETTINGS,
    loading: state.loading,
    error: state.error,
    updating: state.updating,
    updateSettings,
    resetSettings,
    refresh: fetchSettings,
  };
}
