import { useMemo } from 'react';
import { Button, Select } from 'antd';
import { MinusSquareOutlined, PlusSquareOutlined } from '@ant-design/icons';
import type { ClassForest } from './classDiagramModel';
import type { ClassDiagramState } from './useClassDiagram';
import styles from './ClassDiagram.module.css';

interface ClassDiagramToolbarProps {
  /** Every class, to find one by name (also the keyboard way to reach a folded class). */
  forest: ClassForest;
  state: ClassDiagramState;
  /** How many classes are drawn. */
  shown: number;
  /** Why no inheritance is drawn, when none is. */
  hint: string | null;
}

/** Find a class, unfold or fold every branch, and how many classes are drawn. */
export function ClassDiagramToolbar({ forest, state, shown, hint }: ClassDiagramToolbarProps) {
  const options = useMemo(
    () =>
      [...forest.classes.values()]
        .map((c) => ({ value: c.key, label: c.group ? `${c.label} (${c.group})` : c.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [forest],
  );
  return (
    <div className={styles.toolbar}>
      <Select
        className={styles.search}
        size="small"
        showSearch
        optionFilterProp="label"
        placeholder="Find a class"
        aria-label="Find a class"
        options={options}
        value={state.selected}
        onChange={(key: string) => state.reveal(key)}
      />
      <Button size="small" icon={<PlusSquareOutlined />} onClick={state.expandAll}>
        Unfold all
      </Button>
      <Button size="small" icon={<MinusSquareOutlined />} onClick={state.collapseAll}>
        Fold all
      </Button>
      <span className={styles.spacer} />
      {hint && <span className={styles.hint}>{hint}</span>}
      <span className={styles.count}>
        {shown} of {forest.classes.size} classes
      </span>
    </div>
  );
}
