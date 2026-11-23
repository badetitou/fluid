import { sarifLogSchema, type SarifLog } from '@fluid/shared';
import { resolveManifestUrl } from './loader';
import type { DecoratorEntry } from './graphDecorator';

/** One import to fetch: the key `evaluateDecorators` reads it under, and its absolute URL. */
export interface ImportRequest {
  key: string;
  url: string;
}

/**
 * Where an import is read from: a relative URL resolves against the manifest URL of the plugin
 * (when installed from a URL), else against the page. The same origin rules as manifests apply.
 */
export function resolveImportUrl(url: string, baseUrl: string | undefined, origin: string): string {
  let absolute: URL;
  try {
    absolute = new URL(url, baseUrl ?? origin);
  } catch {
    throw new Error(`“${url}” is not a valid URL.`);
  }
  try {
    return resolveManifestUrl(absolute.href, origin).href;
  } catch {
    throw new Error('Imports are read from https:// URLs (or from fluid’s own site).');
  }
}

/** Every import of the decorators, keyed `${spec.id}/${import.id}`; one that cannot resolve is reported in `errors`. */
export function importRequests(
  entries: DecoratorEntry[],
  origin: string,
): { requests: ImportRequest[]; errors: Record<string, string> } {
  const requests: ImportRequest[] = [];
  const errors: Record<string, string> = {};
  for (const { spec, baseUrl } of entries) {
    for (const imp of spec.imports) {
      const key = `${spec.id}/${imp.id}`;
      try {
        requests.push({ key, url: resolveImportUrl(imp.url, baseUrl, origin) });
      } catch (e) {
        errors[key] = e instanceof Error ? e.message : String(e);
      }
    }
  }
  return { requests, errors };
}

/** Validates a fetched body as a SARIF log. */
export function parseSarifLog(json: unknown): SarifLog {
  const parsed = sarifLogSchema.safeParse(json);
  if (!parsed.success) throw new Error('The file is not a SARIF log.');
  return parsed.data;
}
