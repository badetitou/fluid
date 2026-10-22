import styles from './ClassDiagram.module.css';

interface ClassCompartmentProps {
  members: string[];
  /** Members listed before "+N more". */
  max: number;
  label: string;
}

/** An attributes or methods compartment of a class box, cut after `max` members. */
export function ClassCompartment({ members, max, label }: ClassCompartmentProps) {
  const shown = members.slice(0, max);
  const more = members.length - shown.length;
  return (
    <ul className={styles.compartment} aria-label={label}>
      {shown.map((member, i) => (
        <li key={i} className={styles.member} title={member}>
          {member}
        </li>
      ))}
      {more > 0 && <li className={styles.more}>+{more} more</li>}
    </ul>
  );
}
