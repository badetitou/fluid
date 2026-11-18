import type { FastifyRequest } from 'fastify';

/** The OAuth callback URL carries the authorization code and state: log its path only. */
export function loggedUrl(url: string): string {
  return url.startsWith('/api/oauth/callback') ? '/api/oauth/callback' : url;
}

export const logSerializers = {
  req: (req: FastifyRequest) => ({
    method: req.method,
    url: loggedUrl(req.url),
    host: req.host,
    remoteAddress: req.ip,
  }),
};
