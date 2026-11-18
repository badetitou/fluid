import { Client, cacheExchange, fetchExchange, type Exchange } from 'urql';

/** `extra` exchanges watch the network answers (they sit between the cache and the fetch). */
export function createGraphQLClient(url: string, extra: Exchange[] = []): Client {
  return new Client({
    url,
    exchanges: [cacheExchange, ...extra, fetchExchange],
    requestPolicy: 'cache-first',
    // Always POST: Apollo servers (e.g. GraphQLZero) reject GET queries as potential CSRF.
    preferGetMethod: false,
  });
}
