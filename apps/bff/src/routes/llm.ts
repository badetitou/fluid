import type { FastifyInstance } from 'fastify';
import { generateViewBody } from '../validation';
import { describeLlmConfig } from '../llm/config';
import { generateView } from '../llm/generate';
import { LlmError, LlmValidationError } from '../llm/errors';
import type { GenerateViewInput } from '../llm/types';

// LLM-assisted view generation. The BFF builds the prompt from the concept
// schema the frontend sends, calls the configured provider (or the offline
// mock), validates the JSON as a view draft, and returns a full ViewSpec.

export async function llmRoutes(app: FastifyInstance) {
  app.get('/api/llm/config', async () => describeLlmConfig());

  app.post('/api/llm/generate-view', async (req, reply) => {
    const parsed = generateViewBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    try {
      const result = await generateView(parsed.data as GenerateViewInput);
      return { spec: result.spec, provider: result.provider, model: result.model };
    } catch (err) {
      if (err instanceof LlmValidationError) {
        return reply
          .code(422)
          .send({ error: err.message, details: err.errorText, raw: err.raw });
      }
      if (err instanceof LlmError) {
        return reply.code(502).send({ error: err.message });
      }
      req.log.error(err);
      return reply.code(500).send({ error: 'View generation failed' });
    }
  });
}
