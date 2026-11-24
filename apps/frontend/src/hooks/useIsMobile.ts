import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Viewport below 768px: treat as mobile layout. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => matches(MOBILE_QUERY));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches);
    setMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
