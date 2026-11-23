import { z } from 'zod';
import { decoratorSpecSchema, externalWidgetContractSchema } from '@fluid/shared';
import { themeDefinitionSchema } from '../../shared/theme';

/** The seven kinds of plugins; a plugin is of exactly one. */
export const PLUGIN_KINDS = ['theme', 'widget', 'viewBuilder', 'sourceProvider', 'pageAction', 'graphDecorator', 'navSection'] as const;
export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** The serializable half of a view builder (its code is in the plugin's module). */
export const viewBuilderContractSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  /** The colour of its perspectives' marks (`#rrggbb`); the user may change it. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'A colour is written #rrggbb').optional(),
});

/** How a source answers its lists: the defaults of its row settings (the user may change them). */
export const sourceLimitsSchema = z.object({
  /** Rows loaded at first. */
  rowLimit: z.number().int().positive().optional(),
  /** Most rows the source answers per request. */
  maxPerRequest: z.number().int().positive().optional(),
});
export type SourceLimits = z.infer<typeof sourceLimitsSchema>;

/**
 * How a source signs in, when it asks for OAuth: public settings only (no client secret, which the
 * user types in the source settings). Picking the source pre-fills those settings.
 */
export const sourceAuthSchema = z.strictObject({
  kind: z.literal('oauth'),
  issuer: z.url({ protocol: /^https?$/ }),
  clientId: z.string().min(1).max(500),
  scopes: z.array(z.string().regex(/^\S+$/).max(200)).max(50).optional(),
  resource: z.url({ protocol: /^https?$/ }).optional(),
});
export type SourceAuth = z.infer<typeof sourceAuthSchema>;

/** A GraphQL source a source provider offers: a name and the endpoint URL. */
export const sourceEntrySchema = z.object({
  name: z.string().min(1).max(80),
  url: z.url({ protocol: /^https?$/ }),
  description: z.string().max(300).optional(),
  limits: sourceLimitsSchema.optional(),
  auth: sourceAuthSchema.optional(),
  /** Not ready yet (e.g. still being analysed): shown, but cannot be picked. */
  pending: z.boolean().optional(),
});
export type SourceEntry = z.infer<typeof sourceEntrySchema>;

/**
 * The serializable half of a source provider. With `sources` it is plain data;
 * without, the plugin's module lists them (`listSources`).
 */
export const sourceProviderContractSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  sources: z.array(sourceEntrySchema).optional(),
});
export type SourceProviderContract = z.infer<typeof sourceProviderContractSchema>;

/** The serializable half of a page action: a command of the floating button of the columns. */
export const pageActionContractSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  /** A short symbol (an emoji) shown on its button; a generic icon otherwise. */
  icon: z.string().min(1).max(8).optional(),
});
export type PageActionContract = z.infer<typeof pageActionContractSchema>;

/** The serializable half of a nav section: a group of entries of the left sidebar. */
export const navSectionContractSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  /** A short symbol (an emoji) shown on the section's header; a generic icon otherwise. */
  icon: z.string().min(1).max(8).optional(),
});
export type NavSectionContract = z.infer<typeof navSectionContractSchema>;

/** A setting the user fills in Settings → Plugins (e.g. a backend URL). */
export const pluginSettingSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  label: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  placeholder: z.string().max(200).optional(),
  default: z.string().max(500).optional(),
});
export type PluginSetting = z.infer<typeof pluginSettingSchema>;

const CONTRIBUTION_OF_KIND = {
  theme: 'themes',
  widget: 'widgets',
  viewBuilder: 'viewBuilders',
  sourceProvider: 'sourceProviders',
  pageAction: 'pageActions',
  graphDecorator: 'graphDecorators',
  navSection: 'navSections',
} as const;

/** Plain data needs no module: themes, graph decorators, and source providers that list their sources. */
const needsModule = (kind: PluginKind, providers: SourceProviderContract[] = []): boolean =>
  kind === 'sourceProvider' ? providers.some((p) => !p.sources) : kind !== 'theme' && kind !== 'graphDecorator';

/**
 * The manifest of an installable plugin (`manifest.json`). Themes are plain
 * data, and so are source providers that list their sources; widgets, view
 * builders and providers that fetch their sources need the plugin's `module`.
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
      sourceProviders: z.array(sourceProviderContractSchema).optional(),
      pageActions: z.array(pageActionContractSchema).optional(),
      graphDecorators: z.array(decoratorSpecSchema).optional(),
      navSections: z.array(navSectionContractSchema).optional(),
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
          : 'A plugin contributes themes, widgets, viewBuilders, sourceProviders, pageActions, graphDecorators or navSections (one kind only)',
      });
    }
    if (given.length === 1 && needsModule(given[0], m.contributes.sourceProviders) && !m.module) {
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
  if (manifest.contributes.sourceProviders?.length) return 'sourceProvider';
  if (manifest.contributes.pageActions?.length) return 'pageAction';
  if (manifest.contributes.graphDecorators?.length) return 'graphDecorator';
  if (manifest.contributes.navSections?.length) return 'navSection';
  return manifest.contributes.viewBuilders?.length ? 'viewBuilder' : 'theme';
}

/** What a plugin contributes, for display. */
export function contributionLabel(manifest: PluginManifest): string {
  const labels = { theme: 'themes', widget: 'widgets', viewBuilder: 'view builders', sourceProvider: 'sources', pageAction: 'page actions', graphDecorator: 'graph decorators', navSection: 'sidebar sections' };
  return labels[pluginKind(manifest)];
}
