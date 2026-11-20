import { z } from 'zod';
import { sourceEntrySchema, type SourceEntry, type SourceProviderContract } from './manifest';

type Settings = Readonly<Record<string, string>>;

/**
 * A small form a provider shows under its sources in the switcher: one field and
 * a button. `submit` gets what the user typed (trimmed, never empty); a rejection's
 * message is shown under the field. The provider's sources are listed again once it resolves.
 */
export interface SourceAdder {
  /** Title of the form, e.g. “Analyse a GitHub repository”. */
  label: string;
  placeholder?: string;
  /** A line of help under the field. */
  hint?: string;
  submit: (input: string, settings: Settings, signal: AbortSignal) => Promise<void>;
}

/**
 * The code half of a source provider: the GraphQL sources it offers, listed
 * from the manifest (plain data) or asked to a backend by the plugin's module.
 */
export interface SourceProvider {
  id: string;
  label: string;
  listSources: (settings: Settings, signal: AbortSignal) => Promise<SourceEntry[]>;
  /** Lets the user add a source to this provider from the switcher. */
  addSource?: SourceAdder;
  /** While one of its sources is `pending`, its sources are listed again every `pollMs` ms. */
  pollMs?: number;
}

/** A provider whose sources are written in its manifest. */
export function staticSourceProvider(contract: SourceProviderContract): SourceProvider {
  const sources = contract.sources ?? [];
  return { id: contract.id, label: contract.label, listSources: () => Promise.resolve(sources) };
}

const sourceListSchema = z.array(sourceEntrySchema);

/** Polling bounds: a provider never asks more than once a second, nor less than once an hour. */
export const MIN_POLL_MS = 1000;
const pollMsSchema = z.number().int().min(MIN_POLL_MS).max(3_600_000);

const sourceAdderSchema = z.object({
  label: z.string().min(1).max(60),
  placeholder: z.string().max(200).optional(),
  hint: z.string().max(300).optional(),
  submit: z.custom<(input: string, settings: Settings, signal: AbortSignal) => unknown>(
    (v) => typeof v === 'function',
  ),
});

/** What a module gives for one source provider. */
export interface SourceProviderEntry {
  listSources: (settings: Settings, signal: AbortSignal) => unknown;
  addSource?: unknown;
  pollMs?: unknown;
}

/** A module's provider, whose answers (and add form) are checked like any incoming data. */
export function checkedSourceProvider(contract: SourceProviderContract, entry: SourceProviderEntry): SourceProvider {
  const adder = entry.addSource === undefined ? undefined : sourceAdderSchema.safeParse(entry.addSource);
  if (adder && !adder.success) throw new Error(`“${contract.label}” has an invalid add form.`);
  const poll = entry.pollMs === undefined ? undefined : pollMsSchema.safeParse(entry.pollMs);
  if (poll && !poll.success) throw new Error(`“${contract.label}” has an invalid pollMs (${MIN_POLL_MS}–3600000).`);
  const add = adder?.data;
  return {
    id: contract.id,
    label: contract.label,
    listSources: async (settings, signal) => {
      const parsed = sourceListSchema.safeParse(await entry.listSources(settings, signal));
      if (!parsed.success) throw new Error(`“${contract.label}” listed invalid sources.`);
      return parsed.data;
    },
    addSource: add && {
      label: add.label,
      placeholder: add.placeholder,
      hint: add.hint,
      submit: async (input, settings, signal) => {
        await add.submit(input, settings, signal);
      },
    },
    pollMs: poll?.data,
  };
}

/**
 * How long to wait before listing again: the shortest `pollMs` of the providers
 * that have a pending source, or `undefined` when none has to be watched.
 */
export function nextPollDelay(
  providers: readonly Pick<SourceProvider, 'id' | 'pollMs'>[],
  groups: readonly { providerId: string; sources: readonly Pick<SourceEntry, 'pending'>[] }[],
): number | undefined {
  const delays = providers.flatMap((p) => {
    const group = groups.find((g) => g.providerId === p.id);
    const pending = group?.sources.some((s) => s.pending) ?? false;
    return pending && p.pollMs ? [Math.max(p.pollMs, MIN_POLL_MS)] : [];
  });
  return delays.length ? Math.min(...delays) : undefined;
}
