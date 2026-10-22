import { useEffect, useState } from 'react';
import { elementOf, type ElementMesh } from './useElementMeshes';
import type { Element3d } from './sceneModel';
import type { Viewport } from './viewport';

/** The hovered element and where the pointer is, relative to the canvas. */
export interface Hover {
  element: Element3d;
  x: number;
  y: number;
}

/** A press that moved less than this (px) is a click, not a camera drag. */
const CLICK_TOLERANCE = 4;

/** Tracks the element under the pointer, and calls `onClick` with the clicked one. */
export function usePicking(
  viewport: Viewport | null,
  meshes: ElementMesh[],
  onClick?: (element: Element3d) => void,
): Hover | null {
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    if (!viewport) return;
    const canvas = viewport.canvas;
    let pressedAt: [number, number] | null = null;
    const elementAt = (e: PointerEvent) => {
      const mesh = viewport.pick(e.clientX, e.clientY, meshes);
      return mesh ? elementOf(mesh) : undefined;
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons !== 0) return setHover(null);
      const element = elementAt(e);
      const rect = canvas.getBoundingClientRect();
      setHover(element ? { element, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
    };
    const onDown = (e: PointerEvent) => {
      pressedAt = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      const moved = pressedAt ? Math.hypot(e.clientX - pressedAt[0], e.clientY - pressedAt[1]) : Infinity;
      pressedAt = null;
      const element = moved <= CLICK_TOLERANCE ? elementAt(e) : undefined;
      if (element) onClick?.(element);
    };
    const onLeave = () => setHover(null);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [viewport, meshes, onClick]);

  return hover;
}
