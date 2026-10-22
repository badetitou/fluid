import { useRef, useState } from 'react';
import type { Widget } from '@fluid/shared';
import { applyLayout, compact, resolveLayout } from '../../views/gridLayout';

interface Options {
  /** Key of the view being shown; a draft never outlives a switch to another view. */
  viewKey: string | undefined;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Persists the arranged widgets and the view's title; resolves true on success. */
  onSave: (widgets: Widget[], title: string) => Promise<boolean>;
}

/**
 * Arranging a view's widgets with the mouse, like widgets on a macOS desktop.
 * Editing switches the column to full screen (undone on exit) and keeps a
 * draft of the widgets and of the view's title until it is saved or cancelled.
 */
export function useLayoutEditor({ viewKey, isFullscreen, onToggleFullscreen, onSave }: Options) {
  const [draft, setDraft] = useState<{ key: string | undefined; widgets: Widget[]; title: string } | null>(null);
  // Whether entering layout edit switched the column to full screen.
  const enteredFullscreen = useRef(false);
  const current = draft && draft.key === viewKey ? draft : null;
  const widgets = current?.widgets ?? null;
  const title = current?.title ?? '';

  const start = (initial: Widget[], initialTitle: string) => {
    setDraft({ key: viewKey, widgets: initial, title: initialTitle });
    if (onToggleFullscreen && !isFullscreen) {
      enteredFullscreen.current = true;
      onToggleFullscreen();
    }
  };

  const exit = () => {
    setDraft(null);
    if (enteredFullscreen.current) {
      enteredFullscreen.current = false;
      onToggleFullscreen?.();
    }
  };

  const change = (next: Widget[]) => setDraft({ key: viewKey, widgets: next, title });
  const rename = (next: string) => widgets && setDraft({ key: viewKey, widgets, title: next });

  /** Close the gaps between widgets. */
  const tidy = () => widgets && change(applyLayout(widgets, compact(resolveLayout(widgets))));

  const save = async () => {
    if (!widgets) return;
    if (await onSave(applyLayout(widgets, resolveLayout(widgets)), title.trim() || 'Untitled view')) exit();
  };

  return { editing: widgets !== null, widgets, title, start, change, rename, tidy, save, exit };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
