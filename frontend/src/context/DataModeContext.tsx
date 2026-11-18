import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DataMode } from "../api/types";

const STORAGE_KEY = "agrinasa:data-mode";

interface DataModeValue {
  mode: DataMode;
  isDemo: boolean;
  setMode: (mode: DataMode) => void;
  toggleDemo: () => void;
}

const DataModeContext = createContext<DataModeValue | null>(null);

/**
 * Global live/demo switch.
 *
 * Demo mode replays a cached, clearly labelled NASA POWER snapshot. The choice
 * is persisted locally and passed to every data request as `mode=demo`, so a
 * page can never mix live and demo values without showing the banner.
 */
export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "demo" ? "demo" : "live";
  });

  const setMode = useCallback((next: DataMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleDemo = useCallback(() => {
    setModeState((current) => {
      const next = current === "demo" ? "live" : "demo";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, isDemo: mode === "demo", setMode, toggleDemo }),
    [mode, setMode, toggleDemo],
  );

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode(): DataModeValue {
  const context = useContext(DataModeContext);
  if (!context) throw new Error("useDataMode must be used inside DataModeProvider");
  return context;
}
