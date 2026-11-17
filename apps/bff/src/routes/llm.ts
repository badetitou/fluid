import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chatBody, generateViewBody, generateWidgetBody } from '../validation';
import { describeLlmConfig } from '../llm/config';
import { generateView, generateWidget } from '../llm/generate';
import { chat } from '../llm/chat';
import type { ChatInput } from '../llm/chatTypes';
import { LlmError, LlmValidationError } from '../llm/errors';
import type { GenerateViewInput, GenerateWidgetInput } from '../llm/types';

// LLM-assisted view generation. The BFF builds the prompt from the concept
// schema the frontend sends, calls the configured provider (or the offline
// mock), validates the JSON as a view draft, and returns a full ViewSpec
// along with optional reasoning steps.

export async function llmRoutes(app: FastifyInstance) {
  app.get('/api/llm/config', async () => describeLlmConfig());

  // Same as generate-view, but streamed as Server-Sent Events so the UI can show
  // the model working live: `delta` events carry text/thinking chunks (Claude
  // Code only), then a single `result` or `error` event ends the stream.
  app.post('/api/llm/generate-view/stream', async (req, reply) => {
    const parsed = generateViewBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    }

    // Hijacking skips Fastify's send pipeline, so carry over the headers hooks
    // already set on the reply (CORS) when writing the raw response.
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (event: string, data: unknown) => {
      if (!raw.writableEnded) raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await generateView(parsed.data as GenerateViewInput, (delta) =>
        send('delta', delta),
      );
      send('result', {
        spec: result.spec,
        provider: result.provider,
        model: result.model,
        reasoning: result.reasoning,
      });
    } catch (err) {
      if (err instanceof LlmValidationError) {
        send('error', { error: err.message, details: err.errorText, raw: err.raw });
      } else if (err instanceof LlmError) {
        send('error', { error: err.message });
      } else {
        req.log.error(err);
        send('error', { error: 'View generation failed' });
      }
    } finally {
      raw.end();
    }
  });

  app.post('/api/llm/generate-view', async (req, reply) => {
    const parsed = generateViewBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    }

    try {
      const result = await generateView(parsed.data as GenerateViewInput);
      return {
        spec: result.spec,
        provider: result.provider,
        model: result.model,
        reasoning: result.reasoning,
      };
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

  // Chat about the graph or the current view: markdown text, plus an inline
  // ViewSpec when the answer can be shown as data.
  app.post('/api/llm/chat', async (req, reply) => {
    const parsed = chatBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    }

    try {
      return await chat(parsed.data as ChatInput);
    } catch (err) {
      if (err instanceof LlmValidationError) {
        return reply.code(422).send({ error: err.message, details: err.errorText, raw: err.raw });
      }
      if (err instanceof LlmError) {
        return reply.code(502).send({ error: err.message });
      }
      req.log.error(err);
      return reply.code(500).send({ error: 'Chat failed' });
    }
  });

  app.post('/api/llm/generate-widget', async (req, reply) => {
    const parsed = generateWidgetBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    }

    try {
      const result = await generateWidget(parsed.data as GenerateWidgetInput);
      return {
        widget: result.widget,
        provider: result.provider,
        model: result.model,
        reasoning: result.reasoning,
      };
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
      return reply.code(500).send({ error: 'Widget generation failed' });
    }
  });
}
