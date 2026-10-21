import { Alert, Card, Col, Empty, Row, Skeleton } from 'antd';
import { useRootConcepts } from '../../entities/concept';
import { ConceptCard } from './ConceptCard';

interface ConceptCatalogProps {
  /** Laid out in a narrow Miller column: one card per row. */
  narrow: boolean;
}

/** The concepts of the connected source, one card each. */
export function ConceptCatalog({ narrow }: ConceptCatalogProps) {
  const { concepts, fetching, error } = useRootConcepts();
  const span = narrow ? { xs: 24 } : { xs: 24, sm: 12, lg: 8, xxl: 6 };

  if (error) {
    return <Alert type="error" showIcon title="Could not introspect the GraphQL source" description={error.message} />;
  }
  if (!fetching && concepts.length === 0) {
    return <Empty description="No explorable concepts found in this schema" />;
  }

  return (
    <Row gutter={[16, 16]}>
      {fetching
        ? Array.from({ length: 6 }).map((_, i) => (
            <Col key={i} {...span}>
              <Card>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))
        : concepts.map((entry) => (
            <Col key={entry.name} {...span}>
              <ConceptCard entry={entry} />
            </Col>
          ))}
    </Row>
  );
}
