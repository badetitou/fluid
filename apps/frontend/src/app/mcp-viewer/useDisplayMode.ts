import { useCallback, useEffect, useState } from 'react';
import type { DisplayMode, HostBridge, HostContext } from './bridge';

export interface DisplayModeControl {
  fullscreen: boolean;
  /** Whether the host offers fullscreen (unknown counts as yes: the host answers the mode it set). */
  canFullscreen: boolean;
  toggle: () => Promise<void>;
}

/** Fullscreen through `ui/request-display-mode`; the host context has the last word. */
export function useDisplayMode(bridge: HostBridge | undefined, context: HostContext): DisplayModeControl {
  const [mode, setMode] = useState<DisplayMode>(context.displayMode ?? 'inline');
  useEffect(() => {
    if (context.displayMode) setMode(context.displayMode);
  }, [context.displayMode]);
  const canFullscreen = Boolean(bridge) && (context.availableDisplayModes?.includes('fullscreen') ?? true);
  const toggle = useCallback(async () => {
    if (!bridge) return;
    const set = await bridge.requestDisplayMode(mode === 'fullscreen' ? 'inline' : 'fullscreen');
    if (set) setMode(set);
  }, [bridge, mode]);
  return { fullscreen: mode === 'fullscreen', canFullscreen, toggle };
}
