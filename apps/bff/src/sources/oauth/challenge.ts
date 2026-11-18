// Parses a `WWW-Authenticate: Bearer …` challenge (RFC 6750 / RFC 9728): pure.

export interface BearerChallenge {
  resourceMetadata?: string;
  error?: string;
  scope?: string;
}

/** Looks at the first Bearer challenge; parameters may be quoted or bare tokens. */
export function parseBearerChallenge(header: string | null | undefined): BearerChallenge {
  if (!header) return {};
  const start = header.search(/\bBearer\b/i);
  if (start < 0) return {};
  const rest = header.slice(start + 'Bearer'.length);
  const out: BearerChallenge = {};
  for (const m of rest.matchAll(/([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]+))/g)) {
    const value = (m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1');
    const name = m[1].toLowerCase();
    if (name === 'resource_metadata') out.resourceMetadata = value;
    else if (name === 'error') out.error = value;
    else if (name === 'scope') out.scope = value;
  }
  return out;
}
