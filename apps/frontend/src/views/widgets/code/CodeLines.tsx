import { useEffect, useRef } from 'react';
import { Highlight, Prism, themes, type Token } from 'prism-react-renderer';
import { CodeLine } from './CodeLine';
import { registerSmalltalk } from './smalltalk';
import type { CodeView } from './useCodeView';
import styles from './Code.module.css';

interface CodeLinesProps {
  view: CodeView;
  language: string;
  wrap: boolean;
  maxHeight?: number;
}

registerSmalltalk(Prism);

/** The rows of the code widget, highlighted once as a whole, with folded runs that unfold on click. */
export function CodeLines({ view, language, wrap, maxHeight }: CodeLinesProps) {
  const container = useRef<HTMLDivElement>(null);
  const lang = language in Prism.languages ? language : 'plain';
  // Removed and added lines are highlighted together, in the order they are shown.
  const text = view.rows.map((r) => r.text).join('\n');

  useEffect(() => {
    container.current?.querySelector('[data-current]')?.scrollIntoView?.({ block: 'nearest' });
  }, [view.search.current]);

  return (
    <Highlight theme={themes.duotoneDark} code={text} language={lang}>
      {({ className, style, tokens, getTokenProps }) => (
        <div
          ref={container}
          className={`${className} ${styles.code} ${wrap ? styles.wrap : ''}`}
          style={{ ...style, maxHeight }}
          role="region"
          aria-label="Source code"
        >
          {view.items.map((item) =>
            item.kind === 'fold' ? (
              <button key={`fold-${item.from}`} type="button" className={styles.fold} onClick={() => view.unfold(item.from, item.to)}>
                ⋯ {item.to - item.from} unchanged lines
              </button>
            ) : (
              <CodeLine
                key={item.index}
                row={item}
                tokens={tokens[item.index] ?? ([{ types: ['plain'], content: item.text }] as Token[])}
                marks={view.marksOf(item.index)}
                messages={item.newNo != null ? (view.messages.get(item.newNo) ?? []) : []}
                getTokenProps={getTokenProps}
                diff={view.isDiff}
              />
            ),
          )}
        </div>
      )}
    </Highlight>
  );
}
