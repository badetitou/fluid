# syntax=docker/dockerfile:1
# Fluid demo bank GraphQL API (GraphQL Yoga + Pothos + Prisma).
# Build from the repository root: docker build -f apps/backend-demo/Dockerfile -t fluid-backend-demo .

# --- build: install the workspace, generate the Prisma client, then produce a
#     self-contained deploy of just this service (with its workspace deps) ---
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
# OpenSSL + CA certs are required by the Prisma query engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --config.dangerously-allow-all-builds=true
RUN pnpm --filter=@fluid/backend-demo exec prisma generate
RUN pnpm --filter=@fluid/backend-demo --prod=false --legacy \
  --config.dangerously-allow-all-builds=true deploy /app/out

# --- runtime ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/out ./
ENV PORT=4000
EXPOSE 4000
# tsx is bundled in the deploy (esbuild ships a prebuilt binary), so we run the
# TypeScript entrypoint directly — matching the package's "start" script.
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/index.ts"]
