import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ColumnRef } from '../../navigation/millerPath';
import { linkedItem } from './linkModel';

/** Inside the viewer's memory router: hands each link a widget followed to `onLink`, then goes back to the start. */
export function LinkWatcher({ onLink }: { onLink: (ref: ColumnRef) => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const ref = linkedItem(pathname);
    if (!ref) return;
    navigate('/', { replace: true });
    onLink(ref);
  }, [pathname, navigate, onLink]);
  return null;
}
