import { createRoomApi } from './roomApi.ts';
import { addRoom, byCode, byHost, changeRoom, purge, readRow, removeRoom } from './roomQueries.mjs';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path !== '/api/rooms' && !path.startsWith('/api/rooms/')) {
      return new Response('朔望月联机服务', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const db = env.DB;
    if (!db) return Response.json({ error: '房间数据库尚未连接。' }, { status: 503 });
    const handle = createRoomApi({
      get: async (code, now) => readRow(await db.prepare(byCode).bind(code, now).first()),
      byHost: async (key, now) => readRow(await db.prepare(byHost).bind(key, now).first()),
      insert: async (room, expiresAt) => {
        const [, result] = await db.batch([
          db.prepare(purge).bind(Date.now()),
          db.prepare(addRoom).bind(room.code, room.seats[0].key, JSON.stringify(room), expiresAt),
        ]);
        return result.meta.changes === 1;
      },
      update: async (room, generation, expiresAt) => {
        const result = await db.prepare(changeRoom).bind(JSON.stringify(room), expiresAt, room.code, generation).run();
        return result.meta.changes === 1;
      },
      remove: async (code, generation) => {
        const result = await db.prepare(removeRoom).bind(code, generation).run();
        return result.meta.changes === 1;
      },
    }, {
      origins: ['https://zjh-b.github.io', ...(env.SHUOWANG_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean)],
      ready: async () => { await db.prepare('SELECT 1 FROM rooms LIMIT 1').first(); },
    });
    return handle(request);
  },
};
