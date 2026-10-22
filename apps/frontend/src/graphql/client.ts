import { Client, cacheExchange, fetchExchange } from 'urql';

export function createGraphQLClient(url: string): Client {
  return new Client({
    url,
    exchanges: [cacheExchange, fetchExchange],
    requestPolicy: 'cache-first',
    // Always POST: Apollo servers (e.g. GraphQLZero) reject GET queries as potential CSRF.
    preferGetMethod: false,
  });
}
