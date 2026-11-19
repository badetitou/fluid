import { RightOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { ViewCell } from '@fluid/shared';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecCellProps {
  cell?: ViewCell;
  interaction: SpecInteraction;
}

/** The text of a cell; a link opening its entity in the next column when it names one that can be opened. */
export function SpecCell({ cell, interaction }: SpecCellProps) {
  if (!cell) return null;
  const href = interaction.hrefOf(cell.ref);
  if (!href) return <span>{cell.text}</span>;
  return (
    <Link
      className={styles.link}
      to={href}
      onClick={(event) => {
        event.stopPropagation();
        interaction.select(cell.ref);
      }}
    >
      {cell.text} <RightOutlined className={styles.linkIcon} />
    </Link>
  );
}
