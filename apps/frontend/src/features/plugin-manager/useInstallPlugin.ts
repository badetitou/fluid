import { useState } from 'react';
import { usePluginActions, type InstalledPlugin } from '../../entities/plugin';

/**
 * Installing a plugin from a URL, in two steps: read and validate its manifest
 * (`inspect`), then install it once the user confirmed what it contains.
 */
export function useInstallPlugin() {
  const { inspect, install } = usePluginActions();
  const [inspecting, setInspecting] = useState(false);
  const [pending, setPending] = useState<InstalledPlugin | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async (url: string) => {
    if (!url.trim()) return;
    setInspecting(true);
    setError(null);
    setPending(null);
    try {
      setPending(await inspect(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInspecting(false);
    }
  };

  const confirm = () => {
    if (pending) install(pending);
    setPending(null);
  };

  return { inspecting, pending, error, check, confirm, cancel: () => setPending(null) };
}
