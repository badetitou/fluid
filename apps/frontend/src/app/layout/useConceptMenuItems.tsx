import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from 'antd';
import { CloseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { usePinning, useRootConcepts } from '../../entities/concept';
import { ConceptIcon } from '../../features/concept-icon';
import styles from './AppLayout.module.css';

/** Sider entries: home, then every root concept and the pinned ones (which can be unpinned). */
export function useConceptMenuItems() {
  const { concepts } = useRootConcepts();
  const { unpin } = usePinning();

  return useMemo(
    () => [
      { key: 'home', icon: <ThunderboltOutlined />, label: <Link to="/">Concepts</Link> },
      { type: 'divider' as const },
      ...concepts.map((concept) => ({
        key: `concept:${concept.name}`,
        icon: <ConceptIcon name={concept.name} isRoot={concept.isRoot} />,
        label: concept.isRoot ? (
          <Link to={`/miller/${concept.name}`}>{concept.name}</Link>
        ) : (
          <span className={styles.pinned}>
            <Link to={`/miller/${concept.name}`} className={styles.pinnedLink}>
              {concept.name}
            </Link>
            <Tooltip title="Unpin">
              <CloseOutlined
                aria-label={`Unpin ${concept.name}`}
                className={styles.unpin}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  unpin(concept.name);
                }}
              />
            </Tooltip>
          </span>
        ),
      })),
    ],
    [concepts, unpin],
  );
}
