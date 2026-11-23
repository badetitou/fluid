import { z } from 'zod';
import { pluginManifestSchema } from './manifest';
import type { InstalledPlugin } from './types';

// Installed plugins are kept in the browser (localStorage) and read back at start-up. What was saved
// by another version of fluid (a plugin kind this build does not know, a manifest that no longer
// validates) is dropped instead of reaching the plugin runtime, where it would break the app.

const installedPluginSchema = z.object({ url: z.string().min(1), manifest: pluginManifestSchema });

/** The saved installed plugins this build can run; the others are left out. */
export function validInstalledPlugins(saved: unknown): InstalledPlugin[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((entry) => {
    const parsed = installedPluginSchema.safeParse(entry);
    return parsed.success ? [parsed.data as InstalledPlugin] : [];
  });
}
