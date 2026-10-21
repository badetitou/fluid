import { IMAGE_HOSTS } from '../runtime-config';

// Images come from data, i.e. from a backend we do not control: loading one
// leaks the viewer's IP / timing to its host and can be used as a tracking
// pixel. The `image` format therefore goes through two independent checks:
//
//   1. `checkImageUrl` (automatic): the value must be an absolute https URL
//      (http only for localhost), without credentials, on an allowed host.
//   2. A click from the user (see SafeImage), who sees the host before the
//      browser fetches anything. Hosts can be trusted for the current session.

export type ImageUrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether `host` matches an allowlist entry ("example.org" or "*.example.org"). */
export function hostAllowed(host: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true;
  const h = host.toLowerCase();
  return allowed.some((entry) => {
    if (entry.startsWith('*.')) {
      const base = entry.slice(2);
      return h === base || h.endsWith(`.${base}`);
    }
    return h === entry;
  });
}

/** First check: decide whether a raw value may be offered as an image at all. */
export function checkImageUrl(value: unknown, allowed: readonly string[] = IMAGE_HOSTS): ImageUrlCheck {
  if (typeof value !== 'string' || value.trim() === '') return { ok: false, reason: 'Not a URL' };

  let url: URL;
  try {
    // No base: relative URLs would resolve against Fluid's own origin.
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    return { ok: false, reason: `Protocol ${url.protocol} not allowed` };
  }
  if (url.username || url.password) return { ok: false, reason: 'URL contains credentials' };
  if (!hostAllowed(url.hostname, allowed)) {
    return { ok: false, reason: `Host ${url.hostname} not allowed` };
  }
  return { ok: true, url };
}

// Second check memory: hosts the user explicitly trusted, for this tab only.
const SESSION_KEY = 'fluid-trusted-image-hosts';

function readTrusted(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function isHostTrusted(host: string): boolean {
  return readTrusted().has(host.toLowerCase());
}

export function trustHost(host: string): void {
  const trusted = readTrusted();
  trusted.add(host.toLowerCase());
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...trusted]));
  } catch {
    // Storage unavailable: the user will simply be asked again.
  }
}
