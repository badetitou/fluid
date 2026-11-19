import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { SecretKeyError } from '../sources/crypto';

/**
 * Error handler of the routes that use stored source credentials. Key problems (missing/invalid
 * FLUID_SECRET_KEY, undecryptable secret) are server config errors; their messages never contain a secret.
 */
export function secretAwareErrorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof SecretKeyError) return reply.code(500).send({ error: err.message });
  req.log.error({ err: { name: err.name, message: err.message } }, 'source route failed');
  const code = (err as { statusCode?: number }).statusCode;
  const status = code && code < 500 ? code : 500;
  return reply.code(status).send({ error: status < 500 ? err.message : 'Internal error' });
}
