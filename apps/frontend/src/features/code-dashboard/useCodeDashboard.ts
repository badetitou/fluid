import { useEffect, useState } from 'react';
import { useClient } from 'urql';
import { analyse, toFacts, type Dashboard } from './model';
import { CLASSES_QUERY, classesPageSchema, type RawClass } from './schema';

/** Safety net: a project with more classes than this is read only in part. */
const MAX_CLASSES = 5000;

export interface CodeDashboardState {
  dashboard?: Dashboard;
  loading: boolean;
  error?: string;
  /** Classes read so far / announced by the source. */
  progress: { read: number; total?: number };
  /** The source holds more classes than were read. */
  truncated: boolean;
}

/** Reads the classes of the connected Model source page by page and analyses them. */
export function useCodeDashboard(): CodeDashboardState {
  const client = useClient();
  const [state, setState] = useState<CodeDashboardState>({ loading: true, progress: { read: 0 }, truncated: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw: RawClass[] = [];
      let after: string | null = null;
      let total: number | undefined;
      let more = true;
      while (more && raw.length < MAX_CLASSES) {
        const result = await client.query(CLASSES_QUERY, { after }).toPromise();
        if (cancelled) return;
        const parsed = classesPageSchema.safeParse(result.data);
        if (!parsed.success) {
          const reason = result.error?.message ?? 'The source does not answer like a Model server.';
          setState((s) => ({ ...s, loading: false, error: reason }));
          return;
        }
        const page = parsed.data.classes;
        raw.push(...page.nodes);
        total = page.totalCount ?? total;
        more = page.pageInfo.hasNextPage;
        after = page.pageInfo.endCursor;
        setState((s) => ({ ...s, progress: { read: raw.length, total } }));
      }
      if (cancelled) return;
      setState({ loading: false, progress: { read: raw.length, total }, truncated: more, dashboard: analyse(toFacts(raw)) });
    })().catch((e: unknown) => {
      if (!cancelled) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return state;
}
