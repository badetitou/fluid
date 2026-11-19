export const VIEWER_URI = 'ui://fluid/viewer';
export const VIEWER_MIME = 'text/html;profile=mcp-app';

// Placeholder viewer: self-contained, loads nothing. It does the MCP Apps handshake and shows the
// view title with the raw data. The real viewer replaces this page.
export const VIEWER_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>fluid</title>
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
    var m = e.data;
    if (m && m.method === 'ui/notifications/tool-result') show(m.params);
  });
  send({ id: 1, method: 'ui/initialize', params: {
    appInfo: { name: 'fluid-viewer', version: '0.0.0' }, appCapabilities: {}, protocolVersion: '2026-01-26' } });
  send({ method: 'ui/notifications/initialized' });
})();
</script></body></html>
`;
