import { useState } from 'react';
import { Alert, Breadcrumb, Button, Input, Spin, Typography } from 'antd';
import { ConceptGraph } from './ConceptGraph';
import { joinPath, splitPath } from './model';
import { useSchemaWalk } from './useSchemaWalk';
import styles from './ConceptGraph.module.css';

export type PathPickerMode = 'path' | 'field';

interface ConceptPathPickerProps {
  /** `path` picks a concept reached from the root Query; `field` picks a property. */
  mode: PathPickerMode;
  /** Fixed path the walk starts along (the rows a field belongs to); the walk cannot go back past it. */
  base?: string;
  /** Current value, relative to `base`: the graph opens on where it points. */
  value?: string;
  onSelect: (value: string) => void;
}

/**
 * Browses the schema as a graph centered on one concept, to pick a path or a
 * property visually: relations open the concept they lead to, the breadcrumb
 * walks back.
 */
export function ConceptPathPicker({ mode, base, value, onSelect }: ConceptPathPickerProps) {
  const baseSegments = splitPath(base);
  const { walk, focus, loading, enter, back } = useSchemaWalk([...baseSegments, ...splitPath(value)]);
  const [filter, setFilter] = useState('');
  const relative = walk.walked.slice(baseSegments.length);

  const go = (move: () => void) => {
    setFilter('');
    move();
  };

  const crumbs = ['Query', ...walk.walked].map((name, depth) => ({
    key: depth,
    title: (
      <button type="button" className={styles.crumb} disabled={depth < baseSegments.length} onClick={() => go(() => back(depth))}>
        {name}
      </button>
    ),
  }));

  return (
    <div className={styles.picker}>
      <div className={styles.toolbar}>
        <Breadcrumb className={styles.crumbs} items={crumbs} />
        <Input.Search size="small" allowClear placeholder="Filter fields" value={filter} onChange={(e) => setFilter(e.target.value)} className={styles.filter} />
      </div>
      {walk.unresolved.length > 0 && (
        <Alert type="warning" showIcon title={`"${joinPath(walk.unresolved)}" is not in the schema: showing where the path stops.`} />
      )}
      <div className={styles.stage}>
        {loading || !focus ? (
          <Spin />
        ) : (
          <ConceptGraph
            concept={focus}
            filter={filter}
            picked={walk.leaf}
            onEnter={(relation) => go(() => enter(relation))}
            onPick={mode === 'field' ? (property) => onSelect(joinPath([...relative, property])) : undefined}
          />
        )}
      </div>
      <div className={styles.footer}>
        {mode === 'path' ? (
          <>
            <Typography.Text type="secondary" ellipsis>
              Path: <Typography.Text code>{joinPath(walk.walked) || '(whole result)'}</Typography.Text>
            </Typography.Text>
            <Button type="primary" size="small" disabled={loading} onClick={() => onSelect(joinPath(walk.walked))}>
              Use this path
            </Button>
          </>
        ) : (
          <Typography.Text type="secondary">
            Click a property to pick it — relations open the concept they lead to.
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
