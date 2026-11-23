import { Client, cacheExchange, fetchExchange, type Exchange } from 'urql';
import { createEngineFetch, engineFor, isAnalysisUrl } from '../entities/analysis';

/**
 * `extra` exchanges watch the network answers (they sit between the cache and the fetch). A
 * `model-wasm://` URL is answered by the model running in the page, not by the network.
 */
export function createGraphQLClient(url: string, extra: Exchange[] = []): Client {
  return new Client({
    url,
    exchanges: [cacheExchange, ...extra, fetchExchange],
    requestPolicy: 'cache-first',
    // Always POST: Apollo servers (e.g. GraphQLZero) reject GET queries as potential CSRF.
    preferGetMethod: false,
    ...(isAnalysisUrl(url) ? { fetch: createEngineFetch(() => engineFor(url)) } : {}),
  });
}
