import type { ReactNode } from 'react';
import type { ViewSpec } from '@fluid/shared';
import {
  RenderedViewContext,
  ViewActionsContext,
  ViewActionSpecsContext,
  ViewOutputsContext,
  type InvokeAction,
  type OutputsStore,
} from './plugin-api';

const NO_ACTIONS = {};

interface ViewContextsProps {
  spec: ViewSpec;
  outputs: OutputsStore;
  /** Runs the view's actions; null when it has none or writes are off. */
  runAction: InvokeAction | null;
  children: ReactNode;
}

/** What the widgets of a rendered view share: the view itself, its outputs store and its actions. */
export function ViewContexts({ spec, outputs, runAction, children }: ViewContextsProps) {
  return (
    <RenderedViewContext.Provider value={spec}>
      <ViewOutputsContext.Provider value={outputs}>
        <ViewActionSpecsContext.Provider value={spec.actions ?? NO_ACTIONS}>
          <ViewActionsContext.Provider value={runAction}>{children}</ViewActionsContext.Provider>
        </ViewActionSpecsContext.Provider>
      </ViewOutputsContext.Provider>
    </RenderedViewContext.Provider>
  );
}
