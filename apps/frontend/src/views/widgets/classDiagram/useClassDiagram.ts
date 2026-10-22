import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClassDiagramWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import { ancestorsOf, expandableKeys, initialExpanded, type ClassForest } from './classDiagramModel';

const DEFAULT_EXPAND_DEPTH = 2;

export interface ClassDiagramState {
  expanded: ReadonlySet<string>;
  selected?: string;
  /** The class to scroll to, with a counter so finding the same class twice scrolls again. */
  target?: { key: string; seq: number };
  toggle: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** Selects a class: highlights it, emits its row on `selected` and opens it in a new column. */
  open: (key: string) => void;
  /** Unfolds the superclasses of a class, selects it and scrolls to it (finding a class). */
  reveal: (key: string) => void;
}

/** What is unfolded and selected in the diagram, and what the user does with it. */
export function useClassDiagram(
  widget: ClassDiagramWidget,
  forest: ClassForest,
  emit: (port: string, value: unknown) => void,
): ClassDiagramState {
  const depth = widget.expandDepth ?? DEFAULT_EXPAND_DEPTH;
  const [folding, setFolding] = useState(() => ({ forest, expanded: initialExpanded(forest, depth) }));
  const [selected, setSelected] = useState<string>();
  const [target, setTarget] = useState<{ key: string; seq: number }>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  // New data: start again from the initial folding.
  if (folding.forest !== forest) setFolding({ forest, expanded: initialExpanded(forest, depth) });

  const toggle = useCallback((key: string) => {
    setFolding((f) => {
      const expanded = new Set(f.expanded);
      if (!expanded.delete(key)) expanded.add(key);
      return { ...f, expanded };
    });
  }, []);
  const expandAll = useCallback(() => setFolding((f) => ({ ...f, expanded: expandableKeys(f.forest) })), []);
  const collapseAll = useCallback(() => setFolding((f) => ({ ...f, expanded: new Set() })), []);

  const select = useCallback(
    (key: string) => {
      const cls = forest.classes.get(key);
      if (!cls) return undefined;
      setSelected(key);
      emit('selected', cls.row);
      return cls;
    },
    [forest, emit],
  );
  const open = useCallback(
    (key: string) => {
      const cls = select(key);
      const href = cls && hrefOf(cls.row, widget.linkTo);
      if (href) navigate(href);
    },
    [select, hrefOf, widget.linkTo, navigate],
  );
  const reveal = useCallback(
    (key: string) => {
      setFolding((f) => ({ ...f, expanded: new Set([...f.expanded, ...ancestorsOf(f.forest, key)]) }));
      if (select(key)) setTarget((t) => ({ key, seq: (t?.seq ?? 0) + 1 }));
    },
    [select],
  );

  return { expanded: folding.expanded, selected, target, toggle, expandAll, collapseAll, open, reveal };
}
