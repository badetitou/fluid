import { createServer } from 'node:http';
import { buildSchema, graphql } from 'graphql';
import { CLIENT_ID, CLIENT_SECRET, createStubAs } from './oauth-stub';

// Test support, started by hand: an authorization server (auto-approving /authorize) on <port> and
// a token-protected GraphQL resource on <port + 1>.
//   pnpm --filter @fluid/bff exec tsx src/test-support/run-oauth-stub.ts 4600
// `GET <resource>/_expire` revokes every token and makes refresh fail (the BFF then asks to reconnect);
// `GET <resource>/_reset` lets refresh work again.

const port = Number(process.argv[2] ?? 4600);
const as = await createStubAs(port);

const schema = buildSchema(`
  type User { id: ID!, name: String! }
  type Query { hello: String!, users: [User!]!, user(id: ID!): User }
`);
const users = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];
const rootValue = {
  hello: () => 'hello, signed-in world',
  users: () => users,
  user: ({ id }: { id: string }) => users.find((u) => u.id === id),
};

const readBody = (req: NodeJS.ReadableStream) =>
  new Promise<string>((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
  });

const resourceUrl = `http://127.0.0.1:${port + 1}`;
const resource = createServer(async (req, res) => {
  const json = { 'content-type': 'application/json' };
  const path = new URL(req.url ?? '/', resourceUrl).pathname;
  if (path === '/.well-known/oauth-protected-resource') {
    return void res.writeHead(200, json).end(
      JSON.stringify({ resource: resourceUrl, authorization_servers: [as.issuer], scopes_supported: ['read', 'write'] }),
    );
  }
  if (path === '/_expire' || path === '/_reset') {
    as.opts.refreshFails = path === '/_expire';
    if (path === '/_expire') as.revokeAccessTokens();
    return void res.writeHead(200).end(path);
  }
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const body = await readBody(req);
  if (!as.isValidToken(token)) {
    const challenge = `Bearer resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource"`;
    return void res.writeHead(401, { ...json, 'www-authenticate': challenge }).end('{"errors":[{"message":"Unauthorized"}]}');
  }
  const { query, variables } = JSON.parse(body || '{}') as { query?: string; variables?: Record<string, unknown> };
  const result = await graphql({ schema, source: query ?? '{ __typename }', rootValue, variableValues: variables });
  res.writeHead(200, json).end(JSON.stringify(result));
});
await new Promise<void>((r) => resource.listen(port + 1, '127.0.0.1', r));

console.log(`Authorization server (issuer): ${as.issuer}`);
console.log(`Protected GraphQL source:      ${resourceUrl}/graphql`);
console.log(`Client id: ${CLIENT_ID}   Client secret: ${CLIENT_SECRET}   Scopes: read`);
console.log(`Expire sign-in:  curl ${resourceUrl}/_expire   (undo: curl ${resourceUrl}/_reset)`);
