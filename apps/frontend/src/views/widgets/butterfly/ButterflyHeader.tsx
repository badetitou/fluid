import type { Butterfly, ButterflySide } from './butterflyModel';
import styles from './Butterfly.module.css';

interface ButterflyHeaderProps {
  butterfly: Butterfly;
  /** The `groupField` the large sides are grouped by. */
  groupField?: string;
}

/** What a side leaves out: grouped by container, or the lightest neighbours hidden. */
function sideNote(name: string, side: ButterflySide, groupField?: string): string | null {
  if (side.grouped) return `${name} grouped by ${groupField}`;
  if (side.hidden > 0) return `${side.hidden} ${name} not shown (too many: filter the query or set "groupField")`;
  return null;
}

/** The counters "n incoming / m outgoing", and what is grouped or left out. */
export function ButterflyHeader({ butterfly, groupField }: ButterflyHeaderProps) {
  const notes = [sideNote('incoming', butterfly.sides.in, groupField), sideNote('outgoing', butterfly.sides.out, groupField)].filter(
    (n): n is string => n !== null,
  );
  return (
    <div className={styles.header}>
      <span className={styles.count}>
        {butterfly.sides.in.count} incoming / {butterfly.sides.out.count} outgoing
      </span>
      {notes.map((note) => (
        <span key={note} className={styles.note}>
          {note}
        </span>
      ))}
    </div>
  );
}
