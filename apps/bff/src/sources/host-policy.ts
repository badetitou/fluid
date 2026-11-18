import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Which hosts the BFF may call on behalf of a source (proxy, discovery, metadata, token endpoint).
// fluid legitimately targets intranet and localhost APIs, so by default only link-local and
// cloud-metadata ranges are refused. FLUID_BLOCK_PRIVATE_HOSTS=1 also refuses loopback, private
// and shared ranges, for deployments exposed to people who must not reach the internal network.
// The check resolves the name and runs before every request. A name that resolves differently
// between this check and the connection (DNS rebinding) is not covered.

export class HostPolicyError extends Error {}

export type AddressClass = 'public' | 'private' | 'linklocal';

/** Dotted IPv4 inside an IPv6 literal: `::ffff:1.2.3.4` or `::ffff:0102:0304`. */
function mappedV4(ip: string): string | null {
  const m = /^(?:0{0,4}:){2,5}(?:ffff:)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(ip);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function classifyAddress(raw: string): AddressClass {
  const ip = raw.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const v4 = isIP(ip) === 4 ? ip : mappedV4(ip);
  if (v4) {
    const [a, b] = v4.split('.').map(Number);
    if (a === 169 && b === 254) return 'linklocal';
    if (a === 0 || a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return 'private';
    }
    if (a === 100 && b >= 64 && b <= 127) return 'private';
    return 'public';
  }
  // IPv6: the first group decides fe80::/10 (link-local) and fc00::/7 (unique local).
  const first = parseInt(ip.split(':')[0] || '0', 16);
  if (first >= 0xfe80 && first <= 0xfebf) return 'linklocal';
  if (ip === '::1' || ip === '::' || (first >= 0xfc00 && first <= 0xfdff)) return 'private';
  return 'public';
}

export type Resolver = (hostname: string) => Promise<string[]>;
export type HostCheck = (url: URL) => Promise<void>;

const resolveAll: Resolver = async (hostname) => (await lookup(hostname, { all: true })).map((a) => a.address);

export function createHostCheck(opts: { blockPrivate?: boolean; resolve?: Resolver } = {}): HostCheck {
  const { blockPrivate = false, resolve = resolveAll } = opts;
  return async (url) => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    try {
      addresses = isIP(host) || mappedV4(host) ? [host] : await resolve(host);
    } catch {
      return; // unresolvable: the request itself will fail, nothing to connect to
    }
    for (const address of addresses) {
      const kind = classifyAddress(address);
      if (kind === 'linklocal') throw new HostPolicyError('Link-local and metadata addresses are not allowed');
      if (kind === 'private' && blockPrivate) throw new HostPolicyError('Private addresses are not allowed (FLUID_BLOCK_PRIVATE_HOSTS)');
    }
  };
}

/** The policy from the environment, read at call time. */
export function envHostCheck(env: Record<string, string | undefined> = process.env): HostCheck {
  return createHostCheck({ blockPrivate: ['1', 'true'].includes(env.FLUID_BLOCK_PRIVATE_HOSTS ?? '') });
}
