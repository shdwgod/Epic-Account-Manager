// Zero-dependency dev server: serves ../ui and injects the fake `window.api`.
//   node ui-dev/serve.mjs        ->  http://localhost:5173   (?empty ?signedout ?unsaved)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const mock = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'mock-api.js'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__mock-api.js') { res.writeHead(200, { 'Content-Type': types['.js'] }); return res.end(mock); }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  let body = fs.readFileSync(file);
  if (file.endsWith('index.html')) body = Buffer.from(body.toString().replace('<script src="strings.js">', '<script src="/__mock-api.js"></script>\n  <script src="strings.js">'));
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
}).listen(5173, () => console.log('UI preview: http://localhost:5173'));
