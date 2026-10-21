import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, theme, type MenuProps } from 'antd';
import { DeleteOutlined, MinusOutlined } from '@ant-design/icons';
import { GRID_COLUMNS, type Widget } from '@fluid/shared';
import { useElementWidth } from '../hooks/useElementWidth';
import {
  GRID_GAP,
  ROW_HEIGHT,
  SIZE_PRESETS,
  applyLayout,
  cellsToPx,
  clampBox,
  gridRows,
  placeBox,
  resolveLayout,
  type Box,
} from './gridLayout';

interface WidgetGridProps {
  widgets: Widget[];
  /** Renders one widget's card; it should fill the cell it is given. */
  renderWidget: (widget: Widget) => ReactNode;
  /** Edit mode: widgets can be dragged, resized and removed. */
  editing?: boolean;
  /** Called with the widgets, each carrying its new `layout`, after every edit. */
  onChange?: (widgets: Widget[]) => void;
  /** Narrow container: stack widgets full-width, in reading order (view mode only). */
  stacked?: boolean;
}

interface Drag {
  id: string;
  mode: 'move' | 'resize';
  /** The dragged box as it was when the drag started. */
  start: Box;
  dx: number;
  dy: number;
  /** Grid as it would be if the pointer were released now. */
  preview: Box[];
}

/** Extra empty rows shown below the widgets in edit mode, to drop things into. */
const SPARE_ROWS = 3;

/**
 * Lays widgets out on the view's grid. In edit mode it works like widgets on a
 * macOS desktop: drag a widget to move it, drag its corner to resize it, the
 * "−" badge removes it and a right-click offers preset sizes. Widgets snap to
 * cells and never overlap; whatever is in the way moves aside.
 */
export function WidgetGrid({ widgets, renderWidget, editing, onChange, stacked }: WidgetGridProps) {
  const { token } = theme.useToken();
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const boxes = useMemo(() => resolveLayout(widgets), [widgets]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const latest = useRef<Box[] | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);

  // Never leave window listeners behind if the grid unmounts mid-drag.
  useEffect(() => () => stopDrag.current?.(), []);

  const colWidth = Math.max(0, (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const stepX = colWidth + GRID_GAP;
  const stepY = ROW_HEIGHT + GRID_GAP;
  const shown = drag?.preview ?? boxes;
  const byId = new Map(widgets.map((w) => [w.id, w]));

  const rectOf = (b: Box) => ({
    left: b.x * stepX,
    top: b.y * stepY,
    width: cellsToPx(b.w, colWidth),
    height: cellsToPx(b.h, ROW_HEIGHT),
  });

  const commit = (next: Box[]) => onChange?.(applyLayout(widgets, next));

  /** Where the dragged box would land for a pointer offset. */
  const targetFor = (d: Pick<Drag, 'mode' | 'start'>, dx: number, dy: number): Box[] => {
    const s = d.start;
    if (d.mode === 'move') {
      const moved = { ...s, x: Math.round(s.x + dx / stepX), y: Math.round(s.y + dy / stepY) };
      return placeBox(boxes, moved, s);
    }
    const w = Math.round((cellsToPx(s.w, colWidth) + dx + GRID_GAP) / stepX);
    const h = Math.round((cellsToPx(s.h, ROW_HEIGHT) + dy + GRID_GAP) / stepY);
    return placeBox(boxes, { ...s, w: Math.min(w, GRID_COLUMNS - s.x), h });
  };

  const startDrag = (e: React.PointerEvent, box: Box, mode: Drag['mode']) => {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).focus();
    const origin = { x: e.clientX, y: e.clientY };
    const base = { mode, start: box };
    latest.current = boxes;
    setDrag({ id: box.id, ...base, dx: 0, dy: 0, preview: boxes });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      const preview = targetFor(base, dx, dy);
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

  // Arrows move the focused widget one cell, Shift+arrows resize it.
  const onKeyDown = (e: React.KeyboardEvent, box: Box) => {
    if (!editing || drag) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(box.id);
      return;
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (!delta) return;
    e.preventDefault();
    const [dx, dy] = delta;
    const next = e.shiftKey
      ? { ...box, w: Math.min(box.w + dx, GRID_COLUMNS - box.x), h: box.h + dy }
      : { ...box, x: box.x + dx, y: box.y + dy };
    commit(placeBox(boxes, clampBox(next), e.shiftKey ? undefined : box));
  };

  if (stacked && !editing) {
    const ordered = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ordered.map((b) => (
          <div key={b.id} style={{ height: cellsToPx(b.h, ROW_HEIGHT) }}>
            {renderWidget(byId.get(b.id)!)}
          </div>
        ))}
      </div>
    );
  }

  const rows = gridRows(shown) + (editing ? SPARE_ROWS : 0);
  const dragged = drag ? shown.find((b) => b.id === drag.id) : undefined;

  const badge: CSSProperties = {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: token.colorBgElevated,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: token.boxShadowTertiary,
    color: token.colorText,
    fontSize: 10,
    cursor: 'pointer',
    zIndex: 2,
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: cellsToPx(rows, ROW_HEIGHT),
        ['--fluid-grid-focus' as string]: token.colorPrimary,
        transition: drag ? undefined : `height ${token.motionDurationMid}`,
        // Dots at every cell corner hint at the grid while arranging.
        ...(editing && colWidth > 0
          ? {
              backgroundImage: `radial-gradient(circle, ${token.colorBorder} 1.5px, transparent 2px)`,
              backgroundSize: `${stepX}px ${stepY}px`,
              backgroundPosition: `${-GRID_GAP / 2}px ${-GRID_GAP / 2}px`,
            }
          : {}),
      }}
    >
      {editing && <style>{gridEditCss}</style>}

      {/* Where the dragged widget will land. */}
      {dragged && (
        <div
          style={{
            position: 'absolute',
            ...rectOf(dragged),
            borderRadius: token.borderRadiusLG,
            border: `2px dashed ${token.colorPrimaryBorder}`,
            background: token.colorPrimaryBg,
            transition: `all ${token.motionDurationFast}`,
          }}
        />
      )}

      {colWidth > 0 &&
        boxes.map((box) => {
          const widget = byId.get(box.id)!;
          const isDragged = drag?.id === box.id;
          let rect = rectOf(shown.find((b) => b.id === box.id) ?? box);
          if (isDragged) {
            const start = rectOf(drag.start);
            rect =
              drag.mode === 'move'
                ? { ...start, left: start.left + drag.dx, top: start.top + drag.dy }
                : {
                    ...start,
                    width: Math.max(colWidth, start.width + drag.dx),
                    height: Math.max(ROW_HEIGHT, start.height + drag.dy),
                  };
          }

          const sizeMenu: MenuProps['items'] = [
            ...SIZE_PRESETS.map((p) => ({
              key: p.key,
              label: `${p.label} (${p.w}×${p.h})`,
              onClick: () => resize(box, p.w, p.h),
            })),
            { type: 'divider' as const },
            {
              key: 'remove',
              icon: <DeleteOutlined />,
              danger: true,
              label: 'Remove widget',
              onClick: () => remove(box.id),
            },
          ];

          const item = (
            <div
              key={box.id}
              className={editing ? 'fluid-grid-item' : undefined}
              role={editing ? 'group' : undefined}
              aria-label={editing ? `Widget ${widget.title ?? widget.type}` : undefined}
              tabIndex={editing ? 0 : undefined}
              onPointerDown={(e) => startDrag(e, box, 'move')}
              onKeyDown={(e) => onKeyDown(e, box)}
              style={{
                position: 'absolute',
                ...rect,
                borderRadius: token.borderRadiusLG,
                cursor: editing ? (isDragged ? 'grabbing' : 'grab') : undefined,
                touchAction: editing ? 'none' : undefined,
                userSelect: editing ? 'none' : undefined,
                zIndex: isDragged ? 10 : undefined,
                transform: isDragged && drag.mode === 'move' ? 'scale(1.02)' : undefined,
                boxShadow: isDragged ? token.boxShadow : undefined,
                transition: isDragged
                  ? 'transform 120ms, box-shadow 120ms'
                  : `left ${token.motionDurationMid}, top ${token.motionDurationMid}, width ${token.motionDurationMid}, height ${token.motionDurationMid}`,
              }}
            >
              {/* Widget content stays inert while arranging so drags never click through. */}
              <div style={{ height: '100%', pointerEvents: editing ? 'none' : undefined }}>
                {renderWidget(widget)}
              </div>
              {editing && (
                <>
                  <span
                    role="button"
                    aria-label="Remove widget"
                    className="fluid-grid-remove"
                    style={badge}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => remove(box.id)}
                  >
                    <MinusOutlined />
                  </span>
                  <span
                    aria-label="Resize widget"
                    className="fluid-grid-resize"
                    onPointerDown={(e) => startDrag(e, box, 'resize')}
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: 22,
                      height: 22,
                      cursor: 'nwse-resize',
                      color: token.colorTextTertiary,
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
                      <path
                        d="M17 8 v3 a6 6 0 0 1 -6 6 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </>
              )}
            </div>
          );

          return editing ? (
            <Dropdown key={box.id} menu={{ items: sizeMenu }} trigger={['contextMenu']}>
              {item}
            </Dropdown>
          ) : (
            item
          );
        })}
    </div>
  );
}

// The resize corner appears on hover / keyboard focus only.
const gridEditCss = `
.fluid-grid-item .fluid-grid-resize { opacity: 0; transition: opacity 120ms; }
.fluid-grid-item:hover .fluid-grid-resize,
.fluid-grid-item:focus-visible .fluid-grid-resize { opacity: 1; }
.fluid-grid-item:focus-visible { outline: 2px solid var(--fluid-grid-focus); outline-offset: 2px; }
`;
