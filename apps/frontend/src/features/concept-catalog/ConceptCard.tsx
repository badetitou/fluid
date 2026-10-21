import { Link } from 'react-router-dom';
import { Card, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useConcept, type ConceptEntry } from '../../entities/concept';
import { ConceptIcon, ConceptIconPicker } from '../concept-icon';
import { useNavigationHref } from '../../navigation/columnPath';
import styles from './ConceptCatalog.module.css';

/**
 * A concept card introspects its own type, so the catalog fills in
 * progressively. It opens the concept's work list in a column after its own.
 */
export function ConceptCard({ entry }: { entry: ConceptEntry }) {
  const { concept, fetching } = useConcept(entry.name);
  const hrefFor = useNavigationHref();

  return (
    <Link to={hrefFor(entry.name)}>
      <Card
        hoverable
        title={
          <Space>
            <Tooltip title="Change icon">
              <ConceptIconPicker name={entry.name}>
                <ConceptIcon name={entry.name} isRoot={entry.isRoot} />
              </ConceptIconPicker>
            </Tooltip>
            {entry.name}
          </Space>
        }
        extra={<ArrowRightOutlined />}
        className={styles.card}
      >
        {fetching && !concept ? (
          <Skeleton active title={false} paragraph={{ rows: 2 }} />
        ) : (
          <>
            <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} className={styles.description}>
              {concept?.description ?? 'No description provided.'}
            </Typography.Paragraph>
            <Space size={[4, 4]} wrap>
              {concept && <Tag color="blue">{concept.scalarFields.length} fields</Tag>}
              {concept && concept.relationFields.length > 0 && (
                <Tag color="purple">{concept.relationFields.length} relations</Tag>
              )}
              {entry.queries.list && <Tag color="green">list</Tag>}
              {entry.queries.byId && <Tag color="geekblue">by id</Tag>}
              {!entry.isRoot && <Tag>pinned</Tag>}
            </Space>
          </>
        )}
      </Card>
    </Link>
  );
}
