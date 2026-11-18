import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Field } from "../api/types";

const STORAGE_KEY = "agrinasa:last-field-id";

/** Remember the field the user last opened so navigation stays contextual. */
export function readLastFieldId(): number | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function rememberFieldId(fieldId: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(fieldId));
}

/**
 * Loads a single field and keeps localStorage in sync so the header can offer
 * field-scoped navigation after a refresh.
 */
export function useField(fieldId: number | null) {
  const [field, setField] = useState<Field | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(fieldId !== null);

  const load = useCallback(() => {
    if (fieldId === null) {
      setField(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .getField(fieldId, controller.signal)
      .then((data) => {
        setField(data);
        rememberFieldId(data.id);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fieldId]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  return { field, loading, error, reload: load };
}

/** Reads ?field= or falls back to the stored field for simple entry points. */
export function useFieldIdFromRoute(param: string | undefined): number | null {
  if (param) {
    const parsed = Number.parseInt(param, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return readLastFieldId();
}
