#!/bin/sh
# Regenerate the browser-facing runtime config from environment variables.
# Runs via the nginx image's /docker-entrypoint.d/ mechanism before nginx starts.
set -eu

# FLUID_IMAGE_HOSTS is a comma-separated host list -> JSON array of strings.
image_hosts=$(printf '%s' "${FLUID_IMAGE_HOSTS:-}" | tr -d ' "\\\n' | awk -F, '
  { for (i = 1; i <= NF; i++) if ($i != "") out = out (out == "" ? "" : ",") "\"" $i "\"" }
  END { printf "[%s]", out }')

cat > /usr/share/nginx/html/config.js <<EOF
window.__FLUID_CONFIG__ = {
  bffUrl: "${FLUID_BFF_URL:-}",
  defaultGraphqlUrl: "${FLUID_DEFAULT_GRAPHQL_URL:-/graphql}",
  imageHosts: ${image_hosts}
};
EOF

echo "fluid: wrote /config.js (bffUrl='${FLUID_BFF_URL:-}', defaultGraphqlUrl='${FLUID_DEFAULT_GRAPHQL_URL:-/graphql}', imageHosts=${image_hosts})"
