import type { FastifyRequest } from 'fastify';

/** OAuth URLs carry the authorization code, state or scopes: log their path only. */
export function loggedUrl(url: string): string {
  return /^\/api\/(oauth\/|sources\/[^/?]+\/oauth\/)/.test(url) ? url.split('?')[0] : url;
}

export const logSerializers = {
  req: (req: FastifyRequest) => ({
    method: req.method,
    url: loggedUrl(req.url),
    host: req.host,
    remoteAddress: req.ip,
  }),
};
