import { CaretRightOutlined, CloseOutlined, CodeOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { editorKeyAction } from './model';
import { ScriptResultView } from './ScriptResultView';
import { useScriptSession } from './useScriptSession';
import styles from './Script.module.css';

interface ScriptPanelProps {
  endpoint: string;
  itemId: string;
  onClose: () => void;
}

/**
 * The Smalltalk editor docked under a column, run by the image with the
 * column's entity as `self`. A result naming an entity opens it in the next column.
 */
export function ScriptPanel({ endpoint, itemId, onClose }: ScriptPanelProps) {
  const { code, setCode, run, execute, hrefOf } = useScriptSession(endpoint, itemId);

  return (
    <section className={styles.panel} aria-label="Pharo script">
      <div className={styles.panelHeader}>
        <CodeOutlined />
        <span className={styles.panelTitle}>
          Pharo script — <code>self</code> is this entity
        </span>
        <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Close the script" onClick={onClose} />
      </div>
      <Input.TextArea
        className={styles.editor}
        value={code}
        autoFocus
        spellCheck={false}
        autoSize={{ minRows: 2, maxRows: 10 }}
        aria-label="Smalltalk code"
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          const action = editorKeyAction(e);
          if (!action) return;
          e.preventDefault();
          if (action === 'run') execute();
          else onClose();
        }}
      />
      <div className={styles.footer}>
        <span className={styles.hint}>⌘/Ctrl + Enter to run · an entity answered opens in the next column</span>
        <Button type="primary" size="small" icon={<CaretRightOutlined />} loading={run.status === 'running'} onClick={execute}>
          Run
        </Button>
      </div>
      <ScriptResultView run={run} hrefOf={hrefOf} />
    </section>
  );
}
