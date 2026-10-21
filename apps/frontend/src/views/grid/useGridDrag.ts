import { useEffect, useRef, useState } from 'react';
import { GRID_COLUMNS, type Widget } from '@fluid/shared';
import { GRID_GAP, ROW_HEIGHT, applyLayout, cellsToPx, clampBox, placeBox, type Box } from '../gridLayout';

export type DragMode = 'move' | 'resize';

export interface Drag {
  id: string;
  mode: DragMode;
  /** The dragged box as it was when the drag started. */
  start: Box;
  dx: number;
  dy: number;
  /** Grid as it would be if the pointer were released now. */
  preview: Box[];
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

interface Options {
  widgets: Widget[];
  boxes: Box[];
  colWidth: number;
  editing: boolean;
  onChange?: (widgets: Widget[]) => void;
}

/**
 * Mouse and keyboard editing of the widget grid: drag to move, drag the corner
 * to resize, arrows move by one cell, Shift+arrows resize, Delete removes. While
 * dragging, `drag.preview` holds where everything would land on release.
 */
export function useGridDrag({ widgets, boxes, colWidth, editing, onChange }: Options) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const latest = useRef<Box[] | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);

  // Never leave window listeners behind if the grid unmounts mid-drag.
  useEffect(() => () => stopDrag.current?.(), []);

  const stepX = colWidth + GRID_GAP;
  const stepY = ROW_HEIGHT + GRID_GAP;
  const commit = (next: Box[]) => onChange?.(applyLayout(widgets, next));

  /** Where the dragged box would land for a pointer offset. */
  const targetFor = (mode: DragMode, s: Box, dx: number, dy: number): Box[] => {
    if (mode === 'move') {
      return placeBox(boxes, { ...s, x: Math.round(s.x + dx / stepX), y: Math.round(s.y + dy / stepY) }, s);
    }
    const w = Math.round((cellsToPx(s.w, colWidth) + dx + GRID_GAP) / stepX);
    const h = Math.round((cellsToPx(s.h, ROW_HEIGHT) + dy + GRID_GAP) / stepY);
    return placeBox(boxes, { ...s, w: Math.min(w, GRID_COLUMNS - s.x), h });
  };

  const startDrag = (e: React.PointerEvent, box: Box, mode: DragMode) => {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).focus();
    const origin = { x: e.clientX, y: e.clientY };
    latest.current = boxes;
    setDrag({ id: box.id, mode, start: box, dx: 0, dy: 0, preview: boxes });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      const preview = targetFor(mode, box, dx, dy);
      latest.current = preview;
      setDrag((d) => d && { ...d, dx, dy, preview });
    };
    const end = (keep: boolean) => {
      stop();
      if (keep && latest.current && latest.current !== boxes) commit(latest.current);
      latest.current = null;
      setDrag(null);
    };
    const onUp = () => end(true);
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && end(false);
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      stopDrag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    stopDrag.current = stop;
  };

  const remove = (id: string) => onChange?.(widgets.filter((w) => w.id !== id));
  const resize = (box: Box, w: number, h: number) => commit(placeBox(boxes, { ...box, w, h }));

  const onKeyDown = (e: React.KeyboardEvent, box: Box) => {
    if (!editing || drag) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(box.id);
      return;
    }
    const delta = ARROWS[e.key];
    if (!delta) return;
    e.preventDefault();
    const [dx, dy] = delta;
    const next = e.shiftKey
      ? { ...box, w: Math.min(box.w + dx, GRID_COLUMNS - box.x), h: box.h + dy }
      : { ...box, x: box.x + dx, y: box.y + dy };
    commit(placeBox(boxes, clampBox(next), e.shiftKey ? undefined : box));
  };

  return { drag, startDrag, onKeyDown, remove, resize };
}
