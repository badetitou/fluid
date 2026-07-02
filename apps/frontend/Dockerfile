# syntax=docker/dockerfile:1
# Fluid frontend (React + Vite) served by nginx, which also reverse-proxies
# /api -> BFF and /graphql -> backend-demo so the whole app lives on one origin.
# Build from the repository root: docker build -f apps/frontend/Dockerfile -t fluid-frontend .

# --- build the static bundle ---
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --config.dangerously-allow-all-builds=true
RUN pnpm --filter=@fluid/frontend build

# --- serve with nginx ---
FROM nginx:1.27-alpine AS runtime
# Reverse-proxy targets and the browser-facing runtime config are all supplied
# via environment variables at container start (see docker/ files).
ENV FRONTEND_PORT=8080 \
    BFF_UPSTREAM=http://fluid-bff:4001 \
    BACKEND_UPSTREAM=http://fluid-backend-demo:4000 \
    FLUID_BFF_URL="" \
    FLUID_DEFAULT_GRAPHQL_URL="/graphql"
COPY apps/frontend/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/frontend/docker/entrypoint.sh /docker-entrypoint.d/30-fluid-config.sh
RUN chmod +x /docker-entrypoint.d/30-fluid-config.sh
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 8080
