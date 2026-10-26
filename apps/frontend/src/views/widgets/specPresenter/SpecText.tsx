import { useEffect, useMemo, useRef } from 'react';
import type { SpecFluidTextRange } from '@fluid/shared';
import { textSegments } from './textModel';
import styles from './SpecPresenter.module.css';

interface SpecTextProps {
  text: string;
  language?: string;
  highlights?: SpecFluidTextRange[];
}

/** A text node: its highlighted ranges are marked and the first one is scrolled into view. */
export function SpecText({ text, language, highlights }: SpecTextProps) {
  const segments = useMemo(() => textSegments(text, highlights), [text, highlights]);
  const first = useRef<HTMLElement>(null);

  useEffect(() => {
    // jsdom has no scrollIntoView.
    first.current?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  }, [segments]);

  const firstIndex = segments.findIndex((s) => s.highlighted);
  return (
    <pre className={styles.text} data-language={language}>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index} ref={index === firstIndex ? first : undefined} className={styles.highlight}>
            {segment.content}
          </mark>
        ) : (
          segment.content
        ),
      )}
    </pre>
  );
}
