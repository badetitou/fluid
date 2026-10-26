import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSources } from '../../entities/source';

/** The sources to switch between; switching opens the new source's home screen. */
export function useSourceSwitcher() {
  const navigate = useNavigate();
  const sources = useSources();
  const { current, switchTo: connect } = sources;

  const switchTo = useCallback(
    (url: string, name?: string) => {
      const changed = url !== current;
      connect(url, name);
      // The open dashboard and columns belong to the previous source.
      if (changed) navigate('/', { replace: true });
    },
    [current, connect, navigate],
  );

  return { ...sources, switchTo };
}
