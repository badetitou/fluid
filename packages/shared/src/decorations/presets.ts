import { decoratorSpecSchema, type DecoratorSpec, type Selector, type Severity } from './schema';

// Ready-made decorators for the common architecture rules, built on the DSL so
// they read (and translate to Cypher) like any hand-written decorator.

export interface LayerDefinition {
  tag: string;
  match: Selector;
}

/**
 * Layers listed from the top (e.g. ui, application, domain, infrastructure): a
 * layer may depend on itself and the layers below it, never on one above.
 */
export function layersDecorator(options: {
  id: string;
  label: string;
  layers: LayerDefinition[];
  via?: string[];
  severity?: Severity;
}): DecoratorSpec {
  const { layers, via, severity = 'error' } = options;
  return decoratorSpecSchema.parse({
    id: options.id,
    label: options.label,
    description: `Layers, top to bottom: ${layers.map((l) => l.tag).join(' → ')}.`,
    concepts: layers.map((l) => ({ id: `layer-${l.tag}`, tag: l.tag, match: l.match })),
    constraints: layers.slice(1).map((lower, i) => ({
      id: `layer-${lower.tag}-upward`,
      check: 'forbidden',
      severity,
      message: `{source} (${lower.tag}) depends on {target}, in an upper layer`,
      from: { tag: lower.tag },
      to: { tag: layers.slice(0, i + 1).map((l) => l.tag) },
      ...(via ? { via } : {}),
    })),
  });
}

export function noCyclesDecorator(options: {
  id: string;
  label: string;
  among?: Selector;
  via?: string[];
  severity?: Severity;
}): DecoratorSpec {
  return decoratorSpecSchema.parse({
    id: options.id,
    label: options.label,
    constraints: [
      {
        id: 'no-cycle',
        check: 'noCycle',
        severity: options.severity ?? 'warning',
        message: '{source} is on a dependency cycle',
        among: options.among ?? {},
        ...(options.via ? { via: options.via } : {}),
      },
    ],
  });
}
