import { z } from 'zod';
import { sourceEntrySchema, type SourceEntry, type SourceProviderContract } from './manifest';

/**
 * The code half of a source provider: the GraphQL sources it offers, listed
 * from the manifest (plain data) or asked to a backend by the plugin's module.
 */
export interface SourceProvider {
  id: string;
  label: string;
  listSources: (settings: Readonly<Record<string, string>>, signal: AbortSignal) => Promise<SourceEntry[]>;
}

/** A provider whose sources are written in its manifest. */
export function staticSourceProvider(contract: SourceProviderContract): SourceProvider {
  const sources = contract.sources ?? [];
  return { id: contract.id, label: contract.label, listSources: () => Promise.resolve(sources) };
}

const sourceListSchema = z.array(sourceEntrySchema);

/** A module's `listSources`, whose answer is checked like any incoming data. */
export function checkedSourceProvider(
  contract: SourceProviderContract,
  listSources: (settings: Readonly<Record<string, string>>, signal: AbortSignal) => unknown,
): SourceProvider {
  return {
    id: contract.id,
    label: contract.label,
    listSources: async (settings, signal) => {
      const parsed = sourceListSchema.safeParse(await listSources(settings, signal));
      if (!parsed.success) throw new Error(`“${contract.label}” listed invalid sources.`);
      return parsed.data;
    },
  };
}
