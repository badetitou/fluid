import { useEffect, useRef, useState } from 'react';
import { Viewport } from './viewport';

/** A three.js viewport drawing into the returned container; `failed` when WebGL is unavailable. */
export function useViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    let created: Viewport;
    try {
      created = new Viewport(ref.current);
    } catch {
      setFailed(true);
      return;
    }
    setViewport(created);
    return () => {
      created.dispose();
      setViewport(null);
    };
  }, []);

  return { ref, viewport, failed };
}
