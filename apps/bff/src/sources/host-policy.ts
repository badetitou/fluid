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

/** The 8 groups of an IPv6 literal (with `::` and a trailing dotted IPv4 expanded); null if invalid. */
function groupsOf(ip: string): number[] | null {
  let text = ip;
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [, a, b, c, d] = dotted.map(Number);
    text = text.slice(0, dotted.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail, extra] = text.split('::');
  if (extra !== undefined) return null;
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  if (fill < 0 || (tail === undefined && h.length !== 8)) return null;
  const groups = [...h, ...Array<string>(fill).fill('0'), ...t].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

const v4Of = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

/** The IPv4 an IPv6 address embeds or translates to: mapped, compatible, NAT64, 6to4. */
function embeddedV4(g: number[]): string | null {
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(5) && g[5] === 0xffff) return v4Of(g[6], g[7]); // ::ffff:a.b.c.d
  if (zeros(6) && (g[6] || g[7]) && !(g[6] === 0 && g[7] === 1)) return v4Of(g[6], g[7]); // ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4Of(g[6], g[7]); // NAT64
  if (g[0] === 0x2002) return v4Of(g[1], g[2]); // 6to4
  return null;
}

/** Cloud metadata endpoints that are not in 169.254/16 or fe80::/10 (always refused). */
const METADATA_V4 = new Set(['100.100.100.200', '168.63.129.16', '192.0.0.192']);

function classifyV4(v4: string): AddressClass {
  const [a, b] = v4.split('.').map(Number);
  if ((a === 169 && b === 254) || METADATA_V4.has(v4)) return 'linklocal';
  if (a === 0 || a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
    return 'private';
  }
  if (a === 100 && b >= 64 && b <= 127) return 'private';
  return 'public';
}

export function classifyAddress(raw: string): AddressClass {
  const ip = raw.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (isIP(ip) === 4) return classifyV4(ip);
  const g = groupsOf(ip);
  if (!g) return 'public';
  const v4 = embeddedV4(g);
  if (v4) return classifyV4(v4);
  if (g[0] >= 0xfe80 && g[0] <= 0xfebf) return 'linklocal';
  if (g[0] === 0xfd00 && g[1] === 0x0ec2) return 'linklocal'; // AWS IPv6 IMDS, fd00:ec2::/32
  if (g.slice(0, 7).every((x) => x === 0) && g[7] <= 1) return 'private'; // :: and ::1
  if (g[0] >= 0xfc00 && g[0] <= 0xfdff) return 'private';
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
      addresses = isIP(host) ? [host] : await resolve(host);
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
