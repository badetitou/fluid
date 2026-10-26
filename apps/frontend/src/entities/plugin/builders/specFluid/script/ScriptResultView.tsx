import { RightOutlined } from '@ant-design/icons';
import { Alert } from 'antd';
import { Link } from 'react-router-dom';
import type { SpecFluidRef } from '@fluid/shared';
import { itemsTitle } from './model';
import type { ScriptRun } from './useScriptSession';
import styles from './Script.module.css';

interface ScriptResultViewProps {
  run: ScriptRun;
  hrefOf: (ref: SpecFluidRef | undefined) => string | undefined;
}

/** The last run of a script: its error, the item it opened, or what it printed and the items it holds. */
export function ScriptResultView({ run, hrefOf }: ScriptResultViewProps) {
  if (run.status === 'error') {
    return <Alert type="error" showIcon className={styles.result} title={run.message} />;
  }
  if (run.status !== 'done') return null;
  const { result, opened } = run;
  if (opened) {
    return <Alert type="success" showIcon title={<>Opened {result.display} in the next column</>} />;
  }
  return (
    <div className={styles.result}>
      <pre className={styles.display}>{result.display}</pre>
      {result.items && (
        <>
          <div className={styles.itemsTitle}>{itemsTitle(result.items.length, result.truncated)}</div>
          <ul className={styles.items}>
            {result.items.map((item, i) => {
              const href = hrefOf(item.ref);
              return (
                <li key={item.ref?.id ?? i}>
                  {href ? (
                    <Link to={href}>
                      {item.text} <RightOutlined />
                    </Link>
                  ) : (
                    item.text
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
