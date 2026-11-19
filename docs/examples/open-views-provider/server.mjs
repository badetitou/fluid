// A minimal fluid Open Views provider: plain Node, no dependency, no fluid import.
// Run `node server.mjs`, then set `http://localhost:8090` as an Open Views endpoint in fluid.
// Protocol: docs/architecture/OPEN-VIEWS.md. Any object id gets the same three views.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8090);
const NUMBERS = 1000; // items of the "numbers" view, paged through the items route
const square = (n) => ({ cells: [{ text: String(n) }, { text: String(n * n) }] });
const divisor = (n, d) => ({ cells: [{ text: `${d} divides ${n}` }], hasChildren: d > 1 && d < n });
const divisors = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);

const views = {
  about: (id) => ({ title: 'About', priority: 10, view: { kind: 'composite', direction: 'column', children: [
    { kind: 'label', text: `Object ${id}, served by a plain Node provider` },
    { kind: 'text', text: `{ "id": ${JSON.stringify(id)} }`, language: 'json', highlights: [{ start: 2, end: 6 }] },
  ] }, actions: [{ id: 'hello', label: 'Say hello' }] }),
  numbers: () => ({ title: 'Numbers', priority: 20, view: { kind: 'columnedList',
    columns: [{ title: 'n' }, { title: 'n²' }], items: [1, 2, 3, 4, 5].map(square), total: NUMBERS } }),
  divisors: () => ({ title: 'Divisors', priority: 30, view: { kind: 'tree', roots: [], lazy: true } }),
};

// path "0" = the only pageable node of the view; "0.i.j…" = a tree item, divisor of a divisor.
function items(key, path, offset, limit) {
  const [node, ...walk] = path.split('.').map(Number);
  if (node !== 0) return undefined;
  if (key === 'numbers' && walk.length === 0) return page(Array.from({ length: NUMBERS }, (_, i) => square(i + 1)));
  if (key !== 'divisors') return undefined;
  const n = walk.reduce((m, i) => divisors(m)[i] ?? NaN, 360);
  return Number.isNaN(n) ? undefined : page(divisors(n).map((d) => divisor(n, d)));
  function page(all) { return { items: all.slice(offset, offset + limit), total: all.length }; }
}

function answer(req, url) {
  const [, objects, id, viewsSeg, key, sub, actionId, ...rest] = url.pathname.split('/').map(decodeURIComponent);
  if (url.pathname === '/.well-known/fluid-views')
    return [200, { protocol: 'fluid-views', version: 1, name: 'Node example', capabilities: { actions: true } }];
  if (objects !== 'objects' || !id || viewsSeg !== 'views' || rest.length) return [404, { error: 'Not found', code: 'object-not-found' }];
  if (!key) return [200, { object: { id, label: `Object ${id}` }, views: Object.entries(views).map(([k, v]) => ({ key: k, title: v(id).title, priority: v(id).priority })) }];
  if (!views[key]) return [404, { error: `No view ${key}`, code: 'view-not-found' }];
  if (!sub) return [200, { key, ...views[key](id) }];
  if (sub === 'items') {
    const path = url.searchParams.get('path') ?? '0';
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 100);
    if (!/^\d+(\.\d+)*$/.test(path) || !(offset >= 0) || !(limit >= 1)) return [400, { error: 'Bad path, offset or limit', code: 'bad-request' }];
    const body = items(key, path, offset, limit);
    return body ? [200, body] : [400, { error: `Nothing to page at ${path}`, code: 'bad-request' }];
  }
  if (sub === 'actions' && req.method === 'POST' && key === 'about' && actionId === 'hello') return [200, { message: `Hello from object ${id}` }];
  return [404, { error: 'No such action', code: 'action-not-found' }];
}

createServer((req, res) => {
  const [status, body] = req.method === 'OPTIONS' ? [204, null] : answer(req, new URL(req.url, 'http://localhost'));
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' });
  res.end(body === null ? undefined : JSON.stringify(body));
}).listen(PORT, () => console.log(`Open Views provider on http://localhost:${PORT}`));
