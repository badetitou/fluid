# A minimal fluid Open Views provider

[`server.mjs`](server.mjs) is a whole [fluid Open Views](../../architecture/OPEN-VIEWS.md) provider in
one file of plain Node: no dependency, no fluid import. Copy it as a starting point for your own
tool, in any language: only the JSON on the wire matters.

It gives **every** object id the same three views, so it works next to any GraphQL source:

| View | Priority | Shows |
|---|---|---|
| `about` | 10 | a `composite` of a `label` and a highlighted `text`, with an action `hello` |
| `numbers` | 20 | a `columnedList` of 1000 rows: 5 sent, `total: 1000`, the rest paged through the items route |
| `divisors` | 30 | a `tree` sent `lazy`: its roots and every `hasChildren` item come from the items route |

## Run it

```bash
node docs/examples/open-views-provider/server.mjs
```

`PORT=9000 node …` picks another port (default 8090). It answers CORS preflights, so a fluid page on
another origin can call it.

## Try it

```bash
curl -s localhost:8090/.well-known/fluid-views
# {"protocol":"fluid-views","version":1,"name":"Node example","capabilities":{"actions":true}}

curl -s localhost:8090/objects/42/views
# {"object":{"id":"42","label":"Object 42"},"views":[{"key":"about","title":"About","priority":10}, …]}

curl -s localhost:8090/objects/42/views/numbers
curl -s 'localhost:8090/objects/42/views/numbers/items?path=0&offset=995&limit=10'   # rows 996–1000, total 1000
curl -s 'localhost:8090/objects/42/views/divisors/items?path=0'                     # roots: the divisors of 360
curl -s 'localhost:8090/objects/42/views/divisors/items?path=0.5'                   # children of root 5 (divisors of 6)
curl -s -X POST localhost:8090/objects/42/views/about/actions/hello                 # {"message":"Hello from object 42"}
curl -s localhost:8090/objects/42/views/nope                                        # 404 {"error":"No view nope","code":"view-not-found"}
curl -s localhost:8090/objects/%zz/views                                            # 400 {"error":"Bad request","code":"bad-request"}
```

To check the answers, validate them against
[`open-views.schema.json`](../../architecture/open-views.schema.json) (`$defs`: `Discovery`,
`ObjectViewsResponse`, `ViewResponse`, `ViewItemsResponse`, `ViewActionResult`, `Error`) or the zod schemas
of `@fluid/shared` (`packages/shared/src/openViews/protocol.ts`).

## See it in fluid

1. Run fluid locally (`pnpm dev`, or `npx @badetitou/fluid`), on any GraphQL source.
2. In **Settings → Plugins → Open Views**, set the endpoints to `http://localhost:8090`.
3. Open a concept, then one of its items: its detail column lists **About**, **Numbers** and **Divisors**
   among its perspectives. *Load more* pages the numbers; unfolding a divisor loads its children;
   *Say hello* runs the action.
