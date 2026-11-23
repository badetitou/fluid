import type { GraphqlRequest, ModelEngine } from './engine';

/**
 * A `fetch` that answers GraphQL POSTs with the engine: lets urql talk to the in-page model as if it
 * were a server. `getEngine` is read per request, so a rebuilt engine is picked up.
 */
export function createEngineFetch(getEngine: () => ModelEngine | undefined): typeof fetch {
  return async (_input, init) => {
    const engine = getEngine();
    if (!engine) return Response.json({ errors: [{ message: 'The model is not loaded.' }] }, { status: 503 });
    const body = typeof init?.body === 'string' ? init.body : '';
    let request: GraphqlRequest;
    try {
      request = JSON.parse(body) as GraphqlRequest;
    } catch {
      return Response.json({ errors: [{ message: 'Expected a JSON GraphQL request.' }] }, { status: 400 });
    }
    try {
      return Response.json(await engine.execute(request));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ errors: [{ message }] }, { status: 500 });
    }
  };
}
