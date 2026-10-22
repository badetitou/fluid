import type { ComponentType } from 'react';
import type { DataBinding, Widget } from '@fluid/shared';
import type { ActionContext, ActionResult } from '../actions/model';

export type { ActionContext, ActionResult };

/**
 * What a widget renderer receives. The same props for a built-in widget and
 * for a plugin's: its validated config, its main input resolved, a resolver
 * for its other inputs, and `emit` to publish its outputs.
 */
export interface WidgetProps<W extends Widget = Widget> {
  widget: W;
  /** The main input: `widget.data`, resolved. */
  data: unknown;
  /** Resolves another input of the widget (e.g. a second source to compare). */
  resolve: (binding: DataBinding) => unknown;
  /** Publishes a value on an output port; widgets bound to `@<id>` receive it. */
  emit: (port: string, value: unknown) => void;
  /**
   * Runs one of the view's `actions` (a mutation) on `target` / `form`. Absent
   * when the source is read-only or the view has no action: render read-only then.
   */
  invoke?: (action: string, context?: ActionContext) => Promise<ActionResult>;
  /** Height to fill exactly (grid layout); charts honour it. */
  fitHeight?: number;
}

/** The rendering half of a widget type (its contract lives in `@fluid/shared`). */
export interface WidgetRendererDefinition {
  type: string;
  Render: ComponentType<WidgetProps>;
  /** `chart`: sized to its grid cell instead of scrolling inside it (default `flow`). */
  sizing?: 'chart' | 'flow';
}

/** The widgets the engine can render, as the active plugins provide them. */
export interface WidgetCatalog {
  renderers: ReadonlyMap<string, WidgetRendererDefinition>;
  /** Why a type cannot be rendered (its plugin is disabled, missing…), for the placeholder. */
  explainMissing: (type: string) => string;
}
