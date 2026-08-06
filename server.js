'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.env.MECHA_ROOT || __dirname);
const host = process.env.MECHA_HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.webp': 'image/webp'
};

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  response.end(message);
}

function getCachePolicy(relativePath) {
  // Version-pinned vendor/assets never change during a deployment and can be
  // reused by the browser without another NAS transfer.
  if (/^(vendor|assets)(\\|\/)/i.test(relativePath)) {
    return 'public, max-age=31536000, immutable';
  }
  // App files are revalidated, but ETag/304 prevents downloading them again
  // when they have not changed.
  return 'no-cache';
}

function getSafeFilePath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return filePath === root || filePath.startsWith(rootPrefix) ? filePath : null;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return sendText(response, 405, 'Method Not Allowed');
  }

  const filePath = getSafeFilePath(request.url || '/');
  if (!filePath) return sendText(response, 403, 'Forbidden');

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendText(response, 404, 'Not Found');

    const extension = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(root, filePath);
    const etag = `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Length': stats.size,
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': getCachePolicy(relativePath),
      'ETag': etag,
      'Last-Modified': stats.mtime.toUTCString()
    };

    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, headers);
      return response.end();
    }

    response.writeHead(200, headers);

    if (request.method === 'HEAD') return response.end();

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) sendText(response, 500, 'Internal Server Error');
      else response.destroy();
    });
    stream.pipe(response);
  });
});

server.on('error', error => {
  console.error(`[mecha-server] ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`[mecha-server] Serving ${root}`);
  console.log(`[mecha-server] Listening on http://${host}:${port}`);
});
