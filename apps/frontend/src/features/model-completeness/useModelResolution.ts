import { useQuery } from 'urql';
import { looksLikeModel } from '../../entities/plugin/builders/modelViews/detect';
import { useRootConcepts } from '../../hooks/useConcepts';
import { isSyntacticOnly } from './model';
import { MODEL_RESOLUTION_QUERY, modelResolutionSchema, type RawModelResolution } from './schema';

export type ModelResolution = 'loading' | 'incomplete' | 'resolved' | 'unavailable';

/**
 * Reads Model's `analysis.metrics.relationsByProvenance` on Model sources only. Model 0.7 exposes no
 * global "SCIP ran" flag, so a SCIP-resolved relation is the signal that the model is complete.
 */
export function useModelResolution(): ModelResolution {
  const { queriesByType } = useRootConcepts();
  const isModel = looksLikeModel(queriesByType);
  const [result] = useQuery<RawModelResolution>({ query: MODEL_RESOLUTION_QUERY, pause: !isModel });

  if (!isModel || result.error) return 'unavailable';
  if (result.fetching || !result.data) return 'loading';
  const parsed = modelResolutionSchema.safeParse(result.data);
  if (!parsed.success) return 'unavailable';
  return isSyntacticOnly(parsed.data.analysis.metrics.relationsByProvenance) ? 'incomplete' : 'resolved';
}
