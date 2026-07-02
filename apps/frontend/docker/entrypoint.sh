#!/bin/sh
# Regenerate the browser-facing runtime config from environment variables.
# Runs via the nginx image's /docker-entrypoint.d/ mechanism before nginx starts.
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.__FLUID_CONFIG__ = {
  bffUrl: "${FLUID_BFF_URL:-}",
  defaultGraphqlUrl: "${FLUID_DEFAULT_GRAPHQL_URL:-/graphql}"
};
EOF

echo "fluid: wrote /config.js (bffUrl='${FLUID_BFF_URL:-}', defaultGraphqlUrl='${FLUID_DEFAULT_GRAPHQL_URL:-/graphql}')"
