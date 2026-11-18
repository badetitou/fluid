import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clearBinderCookie, readBinder, setBinderCookie } from '../sources/oauth/binder';
import { callbackPage } from '../sources/oauth/callback-page';
import { FlowError } from '../sources/oauth/flow';
import { callbackUri, publicOrigin, scopeList, splitScopes } from '../sources/oauth/model';
import type { OAuthService } from '../sources/oauth/service';
import { httpUrl, isOrigin, issuerUrl } from '../sources/url';

// OAuth for sources: discovery, sign-in (redirect to the authorization server), the callback page
// and sign-out. Everything goes through the OAuth service; nothing here touches Prisma.

export interface OAuthRoutesOptions {
  oauth: OAuthService;
  /** FLUID_PUBLIC_URL: the base URL fluid is reached at; the request's origin when unset. */
  publicUrl?: string;
}

const discoverQuery = z
  .object({ url: httpUrl.optional(), issuer: issuerUrl.optional() })
  .refine((q) => q.url || q.issuer, 'Provide `url` or `issuer`');
const startQuery = z.object({
  scope: z.string().max(2000).optional(),
  /** The fluid UI origin to notify when the popup is done (dev: UI and BFF differ). */
  origin: z.string().max(300).refine(isOrigin, 'origin must be an http(s) origin').optional(),
});

export async function oauthRoutes(app: FastifyInstance, { oauth, publicUrl }: OAuthRoutesOptions) {
  const redirectOrigin = (req: { protocol: string; host: string }) => publicOrigin(publicUrl, req);
  /** The page posts to FLUID_PUBLIC_URL's origin when set (any `?origin` is ignored); else `?origin`, else the callback's. */
  const uiOriginFor = (req: { protocol: string; host: string }, requested?: string) =>
    publicUrl?.trim() ? redirectOrigin(req) : (requested ?? redirectOrigin(req));

  app.get('/api/oauth/discover', async (req, reply) => {
    const parsed = discoverQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: z.flattenError(parsed.error) });
    return oauth.discover(parsed.data);
  });

  app.get('/api/sources/:id/oauth/start', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = startQuery.safeParse(req.query);
    const extra = scopeList.safeParse(splitScopes(query.success ? query.data.scope : undefined));
    if (!query.success || !extra.success) return reply.code(400).send({ error: 'Invalid scope or origin' });
    const redirectUri = callbackUri(redirectOrigin(req));
    try {
      const { url, binder, state } = await oauth.start(id, {
        redirectUri,
        uiOrigin: uiOriginFor(req, query.data.origin),
        extraScopes: extra.data,
      });
      return reply
        .header('set-cookie', setBinderCookie(state, binder, redirectUri.startsWith('https://')))
        .header('cache-control', 'no-store')
        .redirect(url, 302);
    } catch (err) {
      if (err instanceof FlowError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/api/oauth/callback', async (req, reply) => {
    const query = new URL(req.url, 'http://fluid.invalid').searchParams;
    const state = query.get('state');
    const result = await oauth.callback(query, readBinder(req.headers.cookie, state));
    // Only a short failure code reaches the logs: never the code, state, tokens or server text.
    if (!result.ok) req.log.warn({ failure: result.failure }, 'oauth sign-in failed');
    // The binder cookie is cleared only once it matched; an unknown or forged callback sets nothing.
    if (result.bound && state) {
      reply.header('set-cookie', clearBinderCookie(state, callbackUri(redirectOrigin(req)).startsWith('https://')));
    }
    return reply
      .header('cache-control', 'no-store')
      .header('referrer-policy', 'no-referrer')
      .header('content-security-policy', "default-src 'none'; script-src 'unsafe-inline'")
      .type('text/html; charset=utf-8')
      .send(callbackPage({ sourceId: result.sourceId, ok: result.ok, origin: result.uiOrigin ?? uiOriginFor(req) }));
  });

  app.delete('/api/sources/:id/oauth/credential', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await oauth.signOut(id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Not signed in' });
  });
}
