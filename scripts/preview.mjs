import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Static SPA preview of the actual client artifact. No backend proxy is assumed.
const root = resolve('build/client');
await stat(resolve(root, 'index.html'));
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = createServer((request, response) => {
  void (async () => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      response
        .writeHead(502, { 'Content-Type': 'application/json' })
        .end(
          '{"message":"Preview has no gateway. Configure production ingress for /api."}',
        );
      return;
    }
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep) && file !== root) {
      response.writeHead(400).end();
      return;
    }
    try {
      const info = await stat(file);
      if (info.isFile()) {
        response
          .writeHead(200, {
            'Content-Type': mime[extname(file)] || 'application/octet-stream',
          })
          .end(request.method === 'HEAD' ? undefined : await readFile(file));
        return;
      }
    } catch {
      /* Unknown application routes use index.html below. */
    }
    if (pathname.startsWith('/assets/') || extname(pathname)) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, {
        'Content-Type': mime['.html'],
        'Cache-Control': 'no-cache',
      })
      .end(
        request.method === 'HEAD'
          ? undefined
          : await readFile(resolve(root, 'index.html')),
      );
  })().catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`SwiftDrop preview: http://127.0.0.1:${port}`);
});
