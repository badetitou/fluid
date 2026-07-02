# fluid

> Explore and shape your data the way Smalltalk inspectors let you explore objects — but for the web.

**fluid** is an experiment in *interface-less* web apps. Instead of shipping pre-built screens, fluid
connects to a GraphQL data source, introspects it, and lets users **explore the concepts** (types) of the
backend themselves. Clicking a concept opens a dashboard **view**:

- If one or more views already exist for that concept, fluid renders them — with a selector to switch
  between them, just like the tabs of a Smalltalk inspector. A `+view` button lets you create new ones.
- If no view exists (or you press `+`), an **LLM chat** appears. It is pre-prompted with the concept's
  schema and related concepts, and you simply describe what you'd like to see. The LLM returns a
  **declarative view specification** (tables, charts, stats — dashboard-like, little prose).
- Views you like can be **persisted** and reused later **without the LLM**: the saved view simply takes
  the concept (and instance) as a parameter.

Views use a **hybrid model**: parameterizable widgets + a declarative layout (JSON), rendered by an
extensible widget catalog built on [Ant Design](https://ant.design/) and
[@ant-design/plots](https://charts.ant.design/).

## Monorepo layout

| Package | Stack | Role |
| --- | --- | --- |
| `apps/frontend` (`@fluid/frontend`) | React + Vite + TypeScript, Ant Design, @ant-design/plots, urql, react-router | Connect to GraphQL → explore concepts → render views → LLM view-builder chat |
| `apps/bff` (`@fluid/bff`) | Node + TypeScript, Prisma | LLM proxy (OpenAI + Ollama), view persistence, preferences |
| `apps/backend-demo` (`@fluid/backend-demo`) | GraphQL Yoga + Pothos + Prisma | Demo **bank** GraphQL API (Customer, Account, Transaction, Card, Beneficiary, Transfer) seeded with faker |

Shared types (view spec, zod schemas) live in `packages/shared`.

## Requirements

- Node.js >= 22 (required by pnpm 11)
- pnpm (`npm install -g pnpm`, or via Corepack)
- Docker (e.g. via [Colima](https://github.com/abiosoft/colima) on macOS) for local PostgreSQL
- For Kubernetes: `helm`, `kubectl`, and a cluster (e.g. `kind` / `minikube`)

## Getting started

```bash
# 1. install dependencies
pnpm install

# 2. start PostgreSQL (shared by backend-demo and bff)
docker compose up -d

# 3. set up the demo bank database
pnpm --filter @fluid/backend-demo prisma:migrate
pnpm --filter @fluid/backend-demo seed

# 4. run everything in dev mode
pnpm dev
```

The demo GraphQL API defaults to <http://localhost:4000/graphql> (GraphiQL enabled). The frontend
pre-fills this URL on its connection screen.

## Deployment

Everything is containerized and deployed by a single parameterizable **Helm chart**
(`charts/fluid`) that runs the frontend, the BFF, the demo bank, and PostgreSQL.

### Images

Three images are built from the repo root (multi-stage; the frontend is served by nginx,
which also reverse-proxies `/api` → BFF and `/graphql` → backend-demo so the whole app
lives on one origin):

```bash
docker build -f apps/backend-demo/Dockerfile -t fluid-backend-demo:dev .
docker build -f apps/bff/Dockerfile           -t fluid-bff:dev .
docker build -f apps/frontend/Dockerfile      -t fluid-frontend:dev .
```

GitHub Actions publishes them to GHCR as `ghcr.io/<owner>/fluid-{frontend,bff,backend-demo}`
on pushes to `main` and version tags (`v*`); the `CI` workflow runs typecheck, frontend
build, `helm lint`, and manifest validation.

### Local cluster (kind / minikube)

```bash
# build (above), then load the images into the cluster
kind load docker-image fluid-backend-demo:dev fluid-bff:dev fluid-frontend:dev

helm install fluid charts/fluid -f charts/fluid/values-local.yaml \
  --set ingress.enabled=false --namespace fluid --create-namespace

kubectl port-forward -n fluid svc/fluid-frontend 8080:80
# open http://localhost:8080/  (Connect is pre-filled with /graphql)
```

A post-install Job seeds the demo bank; init-containers run `prisma migrate deploy`
before each service starts.

### Cloud

`charts/fluid/values-cloud.yaml` pulls images from GHCR and enables an ingress with TLS via
cert-manager. Point it at your registry and host:

```bash
helm install fluid charts/fluid -f charts/fluid/values-cloud.yaml \
  --set image.registry=ghcr.io/<owner> --set ingress.host=fluid.example.com
```

The browser-facing URLs are configured at container start (`FLUID_BFF_URL`,
`FLUID_DEFAULT_GRAPHQL_URL` → `/config.js`), so one frontend image works for any deployment.

## Status

MVP complete. Build order:

1. ✅ Monorepo scaffold + demo bank backend + concept introspection & explorer
2. ✅ Declarative view engine + widget catalog
3. ✅ Multi-view selector + persistence (BFF)
4. ✅ LLM view generation (OpenAI + Ollama + offline mock)
5. ✅ Dockerfiles + Helm chart + CI (GHCR)

## License

[MIT](./LICENSE)
