import { useMemo } from 'react';
import { Alert, Button, Spin } from 'antd';
import type { InsightWidget as InsightWidgetSpec } from '@fluid/shared';
import { useRenderedView } from '../../plugin-api/viewContext';
import type { WidgetProps } from '../../plugin-api/types';
import { buildInsightRequest } from './insightModel';
import { InsightReport } from './InsightReport';
import { useInsight, type InsightState } from './useInsight';
import { useInsightColors } from './useInsightColors';
import styles from './Insight.module.css';

function InsightBody({ state, onRefresh }: { state: InsightState; onRefresh: () => void }) {
  switch (state.status) {
    case 'loading':
      return (
        <div className={styles.status}>
          <Spin size="small" /> Analysing what the view shows…
        </div>
      );
    case 'empty':
      return <div className={styles.status}>Nothing to analyse yet: the other widgets have no data.</div>;
    case 'unavailable':
      return <Alert type="info" showIcon title="The AI analysis needs the LLM settings of the app." />;
    case 'error':
      return (
        <Alert
          type="warning"
          showIcon
          title="The analysis failed"
          description={state.message}
          action={
            <Button size="small" onClick={onRefresh}>
              Retry
            </Button>
          }
        />
      );
    case 'done':
      return <InsightReport analysis={state.analysis} onRefresh={onRefresh} />;
  }
}

/**
 * An AI analyst of the view: once the other widgets have their data, it sends
 * what they show to the LLM and renders what stands out beyond the obvious.
 */
export function InsightWidget({ widget, resolve }: Pick<WidgetProps<InsightWidgetSpec>, 'widget' | 'resolve'>) {
  const view = useRenderedView();
  const request = useMemo(() => (view ? buildInsightRequest(view, widget, resolve) : null), [view, widget, resolve]);
  const { state, refresh } = useInsight(request);
  const colors = useInsightColors();
  return (
    <div className={styles.root} style={colors}>
      <InsightBody state={state} onRefresh={refresh} />
    </div>
  );
}
