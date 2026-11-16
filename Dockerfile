# syntax=docker/dockerfile:1
# fluid in one image: the same package as `npx @badetitou/fluid` (frontend + API on one port,
# embedded PGlite storage). Build from the repository root: docker build -t fluid .
#
#   docker run -p 4001:4001 -v fluid-data:/data fluid
#
# Set DATABASE_URL to use an already migrated PostgreSQL instead of PGlite (the Helm chart, which
# migrates the database, is the supported way to run fluid on PostgreSQL).

# --- build: bundle the CLI package (frontend, bundled BFF, migrations) into a tarball ---
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --config.dangerously-allow-all-builds=true
RUN pnpm pack:cli && mv out/badetitou-fluid-*.tgz /fluid.tgz

# --- runtime: install the tarball like npm users do ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    FLUID_DATA_DIR=/data \
    BROWSER=none
COPY --from=build /fluid.tgz /tmp/fluid.tgz
RUN npm install --global /tmp/fluid.tgz && rm /tmp/fluid.tgz && npm cache clean --force \
  && mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4001
# Bind all interfaces inside the container; publish the port to choose who can reach it.
ENTRYPOINT ["fluid", "--host", "0.0.0.0", "--no-open"]
CMD ["--port", "4001"]
