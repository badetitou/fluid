import { useMemo } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Button, Flex, Result, Spin, Typography } from 'antd';
import { parseAnalysisRepo, useRepoAnalysis } from '../../entities/analysis';

/** `/analyse/:owner/:name` (`?ref=`): analyses a public GitHub repository in the browser, then opens it. */
export function AnalysePage() {
  const { owner, name } = useParams();
  const [search] = useSearchParams();
  const ref = search.get('ref');
  const parsed = useMemo(() => {
    try {
      return { target: parseAnalysisRepo(owner, name, ref), error: null };
    } catch (err) {
      return { target: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [owner, name, ref]);
  const state = useRepoAnalysis(parsed.target);
  const from = (useLocation().state as { from?: unknown } | null)?.from;

  if (parsed.error) return <Result status="404" title="Unknown repository" subTitle={parsed.error} />;
  // Back to where a reload interrupted the user, else the concepts.
  if (state.phase === 'ready') return <Navigate to={typeof from === 'string' && from.startsWith('/') ? from : '/'} replace />;
  if (state.phase === 'failed') {
    return (
      <Result
        status="error"
        title={`Could not analyse ${parsed.target?.repo}`}
        subTitle={state.error}
        extra={<Button href="/connect">Connect to another source</Button>}
      />
    );
  }
  return (
    <Flex vertical align="center" justify="center" gap={16} style={{ minHeight: '60vh' }}>
      <Spin size="large" />
      <Typography.Title level={4} style={{ margin: 0 }}>
        {state.phase === 'downloading' ? 'Downloading' : 'Analysing'} {parsed.target?.repo}
      </Typography.Title>
      <Typography.Text type="secondary">{state.detail ?? 'Everything runs in your browser.'}</Typography.Text>
    </Flex>
  );
}
