import { useMemo } from 'react';
import type { ClassDiagramWidget } from '@fluid/shared';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { missingSuperReason, type ClassForest } from './classDiagramModel';
import { boxHeight, layoutForest, type BoxContent } from './classLayout';
import { accentColors, classDiagramPalette, paletteVariables } from './classDiagramStyle';
import { ClassDiagramCanvas } from './ClassDiagramCanvas';
import { ClassDiagramToolbar } from './ClassDiagramToolbar';
import { useClassDiagram } from './useClassDiagram';
import styles from './ClassDiagram.module.css';

interface ClassDiagramViewProps {
  widget: ClassDiagramWidget;
  forest: ClassForest;
  emit: (port: string, value: unknown) => void;
  /** Height of the whole widget: toolbar and diagram. */
  height: number;
}

const TOOLBAR_HEIGHT = 32;
const MIN_HEIGHT = 160;
const DEFAULT_MAX_MEMBERS = 6;

/** The laid out diagram with its toolbar (find a class, unfold or fold everything). */
export function ClassDiagramView({ widget, forest, emit, height }: ClassDiagramViewProps) {
  const theme = useWidgetTheme(widget.type);
  const palette = useMemo(() => classDiagramPalette(theme), [theme]);
  const accents = useMemo(() => accentColors(forest, palette), [forest, palette]);
  const state = useClassDiagram(widget, forest, emit);
  const content = useMemo<BoxContent>(
    () => ({
      maxMembers: widget.maxMembers ?? DEFAULT_MAX_MEMBERS,
      attributes: widget.attributesField !== undefined,
      methods: widget.methodsField !== undefined,
      group: widget.groupField !== undefined,
    }),
    [widget.maxMembers, widget.attributesField, widget.methodsField, widget.groupField],
  );
  const layout = useMemo(
    () => layoutForest(forest, state.expanded, (cls) => boxHeight(cls, content)),
    [forest, state.expanded, content],
  );

  return (
    <div className={styles.frame} style={paletteVariables(palette)}>
      <ClassDiagramToolbar
        forest={forest}
        state={state}
        shown={layout.boxes.length}
        hint={missingSuperReason(forest, widget.superField)}
      />
      <ClassDiagramCanvas
        forest={forest}
        layout={layout}
        state={state}
        content={content}
        accents={accents}
        height={Math.max(MIN_HEIGHT, height - TOOLBAR_HEIGHT)}
        label={widget.title ?? 'Class diagram'}
      />
    </div>
  );
}
