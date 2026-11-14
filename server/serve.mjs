import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createRoomApi } from '../.local/rooms/api.mjs';
import { addRoom, byCode, byHost, changeRoom, purge, readRow, removeRoom } from './roomQueries.mjs';

const host = process.env.SHUOWANG_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const dist = resolve('dist');
const database = resolve(process.env.SHUOWANG_ROOM_DB || '.local/rooms.sqlite');
await mkdir(dirname(database), { recursive: true });
const db = new DatabaseSync(database);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(await readFile(new URL('../drizzle/0000_rooms.sql', import.meta.url), 'utf8'));
const queries = [byCode, byHost, purge, addRoom, changeRoom, removeRoom].map(sql => db.prepare(sql));
const [readCode, readHost, removeExpired, insertRoom, updateRoom, deleteRoom] = queries;
removeExpired.run(Date.now());
const cleanup = setInterval(() => removeExpired.run(Date.now()), 15 * 60 * 1000);
cleanup.unref();
const serveApi = createRoomApi({
  get: (code, now) => readRow(readCode.get(code, now)),
  byHost: (key, now) => readRow(readHost.get(key, now)),
  insert: (room, expiresAt) => {
    removeExpired.run(Date.now());
    return insertRoom.run(room.code, room.seats[0].key, JSON.stringify(room), expiresAt).changes === 1;
  },
  update: (room, generation, expiresAt) => updateRoom.run(JSON.stringify(room), expiresAt, room.code, generation).changes === 1,
  remove: (code, generation) => deleteRoom.run(code, generation).changes === 1,
}, { origins: (process.env.SHUOWANG_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean) });

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
};

async function staticFile(url, request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }
  const path = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = resolve(dist, '.' + path);
  // Serve the web build, keeping the Worker bundle and metadata out of the HTTP root.
  if (!file.startsWith(dist + sep) || !/^\/(?:assets\/[^/]+|[^/]+)$/.test(path) || path.includes('\\')) {
    response.writeHead(404).end();
    return;
  }
  const metadata = await stat(file).catch(() => null);
  if (!metadata?.isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('请先运行 npm run build。');
    return;
  }
  response.writeHead(200, {
    'Content-Type': types[extname(file)] || 'text/plain; charset=utf-8',
    'Content-Length': metadata.size,
    'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).on('error', error => response.destroy(error)).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const origin = process.env.SHUOWANG_PUBLIC_ORIGIN || `http://${request.headers.host || `${host}:${port}`}`;
    const url = new URL(request.url, origin);
    if (url.origin !== new URL(origin).origin) {
      response.writeHead(400).end();
      return;
    }
    if (url.pathname !== '/api/rooms' && !url.pathname.startsWith('/api/rooms/')) {
      await staticFile(url, request, response);
      return;
    }
    const options = { method: request.method, headers: request.headers };
    if (request.method === 'POST') Object.assign(options, { body: Readable.toWeb(request), duplex: 'half' });
    const result = await serveApi(new Request(url, options));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    if (response.headersSent) response.destroy();
    else response.writeHead(error instanceof URIError ? 400 : 500).end();
  }
});
server.requestTimeout = 15_000;
server.listen(port, host, () => {
  console.log(`朔望月联机服务 http://${host}:${server.address().port}/`);
  if (!existsSync(resolve(dist, 'index.html'))) console.log('网页尚未构建，请先运行 npm run build。');
});
