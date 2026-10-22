import type { CSSProperties } from 'react';
import { MinusSquareOutlined, PlusSquareOutlined } from '@ant-design/icons';
import { hiddenBelow, type UmlClass } from './classDiagramModel';
import type { BoxContent, PlacedClass } from './classLayout';
import type { ClassDiagramState } from './useClassDiagram';
import { ClassCompartment } from './ClassCompartment';
import styles from './ClassDiagram.module.css';

interface ClassBoxProps {
  cls: UmlClass;
  at: PlacedClass;
  content: BoxContent;
  /** Its package's color. */
  accent?: string;
  state: ClassDiagramState;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`;

/** A UML class: name compartment (stereotype, package, other superclasses), attributes, methods, fold bar. */
export function ClassBox({ cls, at, content, accent, state }: ClassBoxProps) {
  const selected = state.selected === cls.key;
  const expanded = state.expanded.has(cls.key);
  const hidden = hiddenBelow(cls, state.expanded);
  const position = { left: at.x, top: at.y, height: at.height, '--uml-accent': accent } as CSSProperties;
  const showMembers = content.maxMembers > 0;
  return (
    <div className={selected ? `${styles.box} ${styles.selected}` : styles.box} style={position} data-class={cls.key}>
      <div className={styles.header}>
        {cls.abstract && <div className={styles.stereotype}>«abstract»</div>}
        <button
          type="button"
          className={cls.abstract ? `${styles.name} ${styles.abstract}` : styles.name}
          title={cls.label}
          aria-pressed={selected}
          onClick={() => state.open(cls.key)}
        >
          {cls.label}
        </button>
        {content.group && cls.group && <div className={styles.group}>{cls.group}</div>}
        {cls.others.length > 0 && <div className={styles.extends}>extends {cls.others.join(', ')}</div>}
      </div>
      {showMembers && content.attributes && <ClassCompartment members={cls.attributes} max={content.maxMembers} label="Attributes" />}
      {showMembers && content.methods && <ClassCompartment members={cls.methods} max={content.maxMembers} label="Methods" />}
      {cls.children.length > 0 && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Fold' : 'Unfold'} the subclasses of ${cls.label}`}
          onClick={() => state.toggle(cls.key)}
        >
          {expanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />}
          {expanded ? plural(cls.children.length, 'subclass') : `${plural(hidden, 'class')} hidden`}
        </button>
      )}
    </div>
  );
}
