export const VIEWER_URI = 'ui://fluid/viewer';
export const VIEWER_MIME = 'text/html;profile=mcp-app';

// Fallback viewer, served when the real one (apps/frontend/viewer.html, built into the package as
// dist/viewer.html) is not there, e.g. when running from sources. Self-contained, loads nothing (CSP
// forbids it). It does the MCP Apps handshake (ui/initialize, then ui/notifications/initialized once the
// host answered), accepts messages from the host frame only, and shows the view title with the raw data.
export const PLACEHOLDER_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>fluid</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<style>body{font:14px system-ui,sans-serif;margin:12px}pre{overflow:auto;max-height:60vh;background:#f4f4f5;padding:8px;border-radius:6px}</style>
</head><body>
<h1 id="title">fluid</h1>
<pre id="data">Waiting for data...</pre>
<script>
(function () {
  function send(msg) { parent.postMessage(Object.assign({ jsonrpc: '2.0' }, msg), '*'); }
  function show(result) {
    var c = result && result.structuredContent;
    if (!c) return;
    document.getElementById('title').textContent = (c.spec && c.spec.title) || 'fluid';
    document.getElementById('data').textContent = JSON.stringify(c.data, null, 2);
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var m = e.data;
    if (!m) return;
    if (m.id === 1 && (m.result || m.error)) send({ method: 'ui/notifications/initialized' });
    else if (m.method === 'ui/notifications/tool-result') show(m.params);
  });
  send({ id: 1, method: 'ui/initialize', params: {
    appInfo: { name: 'fluid-viewer', version: '0.0.0' }, appCapabilities: {}, protocolVersion: '2026-01-26' } });
})();
</script></body></html>
`;

export interface ViewerPage {
  html: string;
  source: 'packaged' | 'placeholder';
}

/** The packaged viewer when `read` finds a non-empty file at `path`, else the placeholder. */
export function loadViewerHtml(path: string, read: (path: string) => string): ViewerPage {
  try {
    const html = read(path);
    if (html.trim().length > 0) return { html, source: 'packaged' };
  } catch {
    // Not built: from sources, or a corrupted install. The placeholder still does the handshake.
  }
  return { html: PLACEHOLDER_HTML, source: 'placeholder' };
}
