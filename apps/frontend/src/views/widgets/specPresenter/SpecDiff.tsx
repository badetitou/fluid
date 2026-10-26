import { Suspense, useMemo } from 'react';
import { Skeleton } from 'antd';
import type { SpecFluidNode } from '@fluid/shared';
import { LazyCodeWidget } from '../code/lazy';
import { diffCodeWidget } from './model';

interface SpecDiffProps {
  node: Extract<SpecFluidNode, { kind: 'diff' }>;
}

const resolveNothing = () => undefined;

/** A Pharo diff (`SpDiffPresenter`), drawn by the code widget comparing its two texts. */
export function SpecDiff({ node }: SpecDiffProps) {
  const widget = useMemo(() => diffCodeWidget(node), [node]);
  return (
    <Suspense fallback={<Skeleton active />}>
      <LazyCodeWidget widget={widget} data={node} resolve={resolveNothing} />
    </Suspense>
  );
}
