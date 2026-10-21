import { useCallback, useMemo, useState } from 'react';
import { checkImageUrl, isHostTrusted, trustHost } from '../../imageSafety';
import type { HistoryNode } from './historyModel';

export interface AvatarConsent {
  /** Hosts of the avatars the user has not allowed yet. */
  pendingHosts: string[];
  /** The URL to load for a version's avatar, once allowed. */
  srcOf: (node: HistoryNode) => string | undefined;
  /** Trusts every pending host for the session. */
  allow: () => void;
}

/**
 * Avatars come from data, like the `image` format: they pass `checkImageUrl`
 * and load only once the user allowed their host (one click for the widget
 * instead of one per line).
 */
export function useAvatarConsent(nodes: HistoryNode[]): AvatarConsent {
  const [, setVersion] = useState(0);
  const urls = useMemo(() => {
    const out = new Map<string, URL>();
    for (const n of nodes) {
      const check = n.avatar ? checkImageUrl(n.avatar) : undefined;
      if (check?.ok) out.set(n.key, check.url);
    }
    return out;
  }, [nodes]);
  const pendingHosts = [...new Set([...urls.values()].map((u) => u.hostname))].filter((h) => !isHostTrusted(h));
  const srcOf = (node: HistoryNode) => {
    const url = urls.get(node.key);
    return url && isHostTrusted(url.hostname) ? url.href : undefined;
  };
  const allow = useCallback(() => {
    for (const url of urls.values()) trustHost(url.hostname);
    setVersion((v) => v + 1);
  }, [urls]);
  return { pendingHosts, srcOf, allow };
}
