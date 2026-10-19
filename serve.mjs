// A tiny local web server with no dependencies. Run: node serve.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'styles.css', 'config.json']);

http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = resolve(join(root, normalize(path)));
    const rel = file.slice(root.length + 1);
    // only serve the app itself, never the tests, the server or any hidden file
    const allowed = file.startsWith(root + sep) && (PUBLIC.has(rel) || rel.startsWith('src' + sep) || rel.startsWith('vendor' + sep));
    if (!allowed) { res.writeHead(404); return res.end('Not found'); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Life & Work is running at http://localhost:${PORT}`);
  console.log('Keep this window open while you use the app. Press Ctrl+C to stop.');
});
