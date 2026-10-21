import { useCallback, type ReactNode } from 'react';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Column, LinkTo } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';
import { getNavigationId } from '../../navigation/linkExtractor';
import { useNavigationHref } from '../../navigation/columnPath';
import styles from './Cell.module.css';

/** The route opening the item a row links to, when the row has its id. */
export function useLinkHref(): (row: Record<string, unknown>, linkTo?: LinkTo) => string | undefined {
  const hrefFor = useNavigationHref();
  return useCallback(
    (row, linkTo) => {
      const id = linkTo ? getNavigationId(row, linkTo.idField ?? 'id') : undefined;
      return linkTo && id ? hrefFor(linkTo.concept, id) : undefined;
    },
    [hrefFor],
  );
}

/** Wraps `content` in a link opening the linked item's column, when `row` has its id. */
export function useLinkRenderer(): (content: ReactNode, row: Record<string, unknown>, linkTo?: LinkTo) => ReactNode {
  const navigate = useNavigate();
  const hrefOf = useLinkHref();
  return useCallback(
    (content, row, linkTo) => {
      const href = hrefOf(row, linkTo);
      if (!href) return content;
      return (
        <a className={styles.link} onClick={() => navigate(href)}>
          {content} <RightOutlined className={styles.linkIcon} />
        </a>
      );
    },
    [navigate, hrefOf],
  );
}

/** Renders a column's cell for a row: the formatted value, as a link when the column has `linkTo`. */
export function useCellRenderer(): (col: Column, row: Record<string, unknown>) => ReactNode {
  const link = useLinkRenderer();
  return useCallback(
    (col, row) => link(formatValue(getPath(row, col.key), col.format, { currency: col.currency }), row, col.linkTo),
    [link],
  );
}
