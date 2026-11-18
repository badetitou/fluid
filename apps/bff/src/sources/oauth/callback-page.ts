// The page the popup lands on after the authorization server: pure, nothing from the query
// string goes in (only the source id we stored and a boolean).

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
/** JSON for an inline script: `<` is escaped so `</script>` cannot appear. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

export function callbackPage(opts: { sourceId: string | null; ok: boolean; origin: string }): string {
  const message = { type: 'fluid-oauth', sourceId: opts.sourceId, ok: opts.ok };
  const text = opts.ok
    ? 'Signed in. You can close this window.'
    : 'Sign-in failed. You can close this window and try again.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>fluid sign-in</title></head>
<body><p>${escapeHtml(text)}</p>
<script>
try { if (window.opener) { window.opener.postMessage(${scriptJson(message)}, ${scriptJson(opts.origin)}); } } catch (e) {}
window.close();
</script></body></html>`;
}
