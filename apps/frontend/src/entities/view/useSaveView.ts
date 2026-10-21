import { useCallback, useState } from 'react';
import type { ViewSpec } from '@fluid/shared';
import { bffClient, type SavedView } from '../../bff/client';

export interface SaveViewOptions {
  /** Updates this saved view instead of creating a new one. */
  editingId?: string;
  isDefault: boolean;
}

/**
 * Creates or updates a saved view from an editor (assistant, JSON). The error
 * stays in state so the editor can show it inline next to its form.
 */
export function useSaveView() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (spec: ViewSpec, { editingId, isDefault }: SaveViewOptions) => {
    setSaving(true);
    setError(null);
    try {
      return editingId
        ? await bffClient.updateView(editingId, { spec, isDefault })
        : await bffClient.createView(spec, isDefault);
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, error, setError, save } as const;
}

export type { SavedView };
