import { useMemo, useState } from 'react';
import { searchRows, type Match } from './markModel';

export interface CodeSearch {
  query: string;
  setQuery: (query: string) => void;
  matches: Match[];
  /** The hit the user is on, scrolled into view. */
  current?: Match;
  currentIndex: number;
  next: () => void;
  previous: () => void;
}

/** Search over the rows' texts, with the hit the user steps through. */
export function useCodeSearch(texts: string[]): CodeSearch {
  const [query, setQueryState] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const matches = useMemo(() => searchRows(texts, query), [texts, query]);
  const step = (by: number) => setCurrentIndex((i) => (matches.length ? (i + by + matches.length) % matches.length : 0));

  return {
    query,
    setQuery: (q) => {
      setQueryState(q);
      setCurrentIndex(0);
    },
    matches,
    current: matches[currentIndex],
    currentIndex,
    next: () => step(1),
    previous: () => step(-1),
  };
}
