import { z } from 'zod';
import { externalWidgetContractSchema } from '@fluid/shared';
import { themeDefinitionSchema } from '../../shared/theme';

/** The three kinds of plugins; a plugin is of exactly one. */
export const PLUGIN_KINDS = ['theme', 'widget', 'viewBuilder'] as const;
export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** The serializable half of a view builder (its code is in the plugin's module). */
export const viewBuilderContractSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
});

/** A setting the user fills in Settings → Plugins (e.g. a backend URL). */
export const pluginSettingSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  placeholder: z.string().max(200).optional(),
  default: z.string().max(500).optional(),
});
export type PluginSetting = z.infer<typeof pluginSettingSchema>;

const CONTRIBUTION_OF_KIND = { theme: 'themes', widget: 'widgets', viewBuilder: 'viewBuilders' } as const;

/**
 * The manifest of an installable plugin (`manifest.json`). Themes are plain
 * data; widgets and view builders need the plugin's `module`, an ES module.
 * `kind` may be left out when the contributions say it (older manifests).
 */
export const pluginManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'Plugin ids are lowercase words joined by "-"'),
    name: z.string().min(1).max(60),
    version: z.string().min(1).max(30),
    kind: z.enum(PLUGIN_KINDS).optional(),
    description: z.string().max(500).optional(),
    author: z.string().max(100).optional(),
    homepage: z.url().optional(),
    /** ES module rendering the widgets or building the views, relative to the manifest. */
    module: z.string().min(1).optional(),
    settings: z.array(pluginSettingSchema).optional(),
    contributes: z.object({
      themes: z.array(themeDefinitionSchema).optional(),
      widgets: z.array(externalWidgetContractSchema).optional(),
      viewBuilders: z.array(viewBuilderContractSchema).optional(),
    }),
  })
  .superRefine((m, ctx) => {
    const given = (Object.keys(CONTRIBUTION_OF_KIND) as PluginKind[]).filter(
      (k) => (m.contributes[CONTRIBUTION_OF_KIND[k]]?.length ?? 0) > 0,
    );
    if (given.length !== 1 || (m.kind && m.kind !== given[0])) {
      ctx.addIssue({
        code: 'custom',
        path: ['contributes'],
        message: m.kind
          ? `A ${m.kind} plugin contributes ${CONTRIBUTION_OF_KIND[m.kind]}, and nothing else`
          : 'A plugin contributes themes, widgets or viewBuilders (one kind only)',
      });
    }
    if (given[0] !== 'theme' && given.length === 1 && !m.module) {
      ctx.addIssue({ code: 'custom', path: ['module'], message: `A plugin contributing ${CONTRIBUTION_OF_KIND[given[0]]} needs a "module"` });
    }
    (m.contributes.widgets ?? []).forEach((w, i) => {
      if (!w.type.startsWith(`${m.id}/`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contributes', 'widgets', i, 'type'],
          message: `Widget types of plugin "${m.id}" start with "${m.id}/"`,
        });
      }
    });
  });
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

/** The kind of a (valid) manifest, said or deduced from what it contributes. */
export function pluginKind(manifest: PluginManifest): PluginKind {
  if (manifest.kind) return manifest.kind;
  if (manifest.contributes.widgets?.length) return 'widget';
  return manifest.contributes.viewBuilders?.length ? 'viewBuilder' : 'theme';
}

/** What a plugin contributes, for display. */
export function contributionLabel(manifest: PluginManifest): string {
  return { theme: 'themes', widget: 'widgets', viewBuilder: 'view builders' }[pluginKind(manifest)];
}
