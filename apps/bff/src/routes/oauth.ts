import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { callbackPage } from '../sources/oauth/callback-page';
import { FlowError } from '../sources/oauth/flow';
import { callbackUri, publicOrigin, scopeList, splitScopes } from '../sources/oauth/model';
import type { OAuthService } from '../sources/oauth/service';

// OAuth for sources: discovery, sign-in (redirect to the authorization server), the callback page
// and sign-out. Everything goes through the OAuth service; nothing here touches Prisma.

export interface OAuthRoutesOptions {
  oauth: OAuthService;
  /** FLUID_PUBLIC_URL: the base URL fluid is reached at; the request's origin when unset. */
  publicUrl?: string;
}

const httpUrl = z.url({ protocol: /^https?$/ }).max(2000);
const discoverQuery = z
  .object({ url: httpUrl.optional(), issuer: httpUrl.optional() })
  .refine((q) => q.url || q.issuer, 'Provide `url` or `issuer`');
const startQuery = z.object({ scope: z.string().max(2000).optional() });

export async function oauthRoutes(app: FastifyInstance, { oauth, publicUrl }: OAuthRoutesOptions) {
  const originOf = (req: { protocol: string; host: string }) => publicOrigin(publicUrl, req);

  app.get('/api/oauth/discover', async (req, reply) => {
    const parsed = discoverQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: z.flattenError(parsed.error) });
    return oauth.discover(parsed.data);
  });

  app.get('/api/sources/:id/oauth/start', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = startQuery.safeParse(req.query);
    const extra = scopeList.safeParse(splitScopes(query.success ? query.data.scope : undefined));
    if (!query.success || !extra.success) return reply.code(400).send({ error: 'Invalid scope' });
    try {
      const url = await oauth.start(id, callbackUri(originOf(req)), extra.data);
      return reply.header('cache-control', 'no-store').redirect(url, 302);
    } catch (err) {
      if (err instanceof FlowError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/api/oauth/callback', async (req, reply) => {
    const result = await oauth.callback(new URL(req.url, 'http://fluid.invalid').searchParams);
    // Only a short failure code reaches the logs: never the code, state, tokens or server text.
    if (!result.ok) req.log.warn({ failure: result.failure }, 'oauth sign-in failed');
    const origin = result.redirectUri ? new URL(result.redirectUri).origin : originOf(req);
    return reply
      .header('cache-control', 'no-store')
      .header('referrer-policy', 'no-referrer')
      .header('content-security-policy', "default-src 'none'; script-src 'unsafe-inline'")
      .type('text/html; charset=utf-8')
      .send(callbackPage({ sourceId: result.sourceId, ok: result.ok, origin }));
  });

  app.delete('/api/sources/:id/oauth/credential', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await oauth.signOut(id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Not signed in' });
  });
}
