import { expect, it } from 'vitest';
import { makeRng } from '../src/game/cards';
import { createRoomApi, type RoomRecord, type RoomStore, type StoredRoom } from '../server/roomApi';

const origin = 'https://game.example.test';
const token = (seat: number) => String(seat + 1).repeat(64);

function fixture() {
  const rooms = new Map<string, StoredRoom>();
  const store: RoomStore = {
    get: (code, now) => {
      const row = rooms.get(code);
      return row && row.expiresAt > now ? row : undefined;
    },
    byHost: (host, now) => [...rooms.values()].find(row => row.expiresAt > now && row.room.seats[0].key === host),
    insert: (room: RoomRecord, expiresAt) => {
      if (rooms.has(room.code)) return false;
      rooms.set(room.code, { room, expiresAt, generation: 0 });
      return true;
    },
    update: (room, generation, expiresAt) => {
      if (rooms.get(room.code)?.generation !== generation) return false;
      rooms.set(room.code, { room, expiresAt, generation: generation + 1 });
      return true;
    },
  };
  let now = 1000;
  const api = createRoomApi(store, { origins: [origin], random: makeRng(28), now: () => now, turnMs: 5000 });

  async function request(path: string, seat?: number, data?: object, requestOrigin = origin) {
    const response = await api(new Request(`https://rooms.example.test/api/rooms${path}`, {
      method: data ? 'POST' : 'GET',
      headers: { Origin: requestOrigin, ...(seat !== undefined && { Authorization: `Bearer ${token(seat)}` }),
        ...(data && { 'Content-Type': 'application/json' }) },
      body: data && JSON.stringify(data),
    }));
    return { response, status: response.status, body: await response.json() };
  }
  return { request, advanceTime: (ms: number) => { now += ms; } };
}

it('创建与加入可重试，房主只能在座位齐全后开局', async () => {
  const { request } = fixture();
  const created = await request('', 0, { size: 2, name: '甲' });
  const { code, revision } = created.body;
  const path = '/' + code;
  expect(created.status).toBe(201);
  expect(created.response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  expect(created.response.headers.get('Cache-Control')).toBe('no-store');
  expect((await request('', 0, { size: 2, name: '甲' })).body.code).toBe(code);
  expect((await request(path, 0, { kind: 'start', revision })).status).toBe(409);
  expect((await request(path)).status).toBe(401);
  expect((await request(path, 3)).status).toBe(403);
  const joined = await request(path, 1, { kind: 'join', name: '乙' });
  expect(joined.body).toMatchObject({ seat: 1, players: ['甲', '乙'], table: null });
  expect((await request(path, 1, { kind: 'join', name: '乙' })).body.players).toEqual(['甲', '乙']);
  expect((await request(path, 2, { kind: 'join', name: '丙' })).status).toBe(409);
  expect((await request(path, 1, { kind: 'start', revision: joined.body.revision })).status).toBe(403);
});

it('四人各自只收到自己的暗牌，旧操作不会重复扣款', async () => {
  const { request } = fixture();
  const created = await request('', 0, { size: 4, name: '甲' });
  const path = '/' + created.body.code;
  let revision = created.body.revision;
  for (let seat = 1; seat < 4; seat++) {
    const joined = await request(path, seat, { kind: 'join', name: '乙丙丁'[seat - 1] });
    revision = joined.body.revision;
  }
  const started = await request(path, 0, { kind: 'start', revision });
  expect(started.body.table.cards.map((pair: unknown[]) => pair[1] !== null)).toEqual([true, false, false, false]);
  expect(started.body.table.rule).toBeNull();
  expect(started.body.table).not.toHaveProperty('undealt');
  expect(started.body).not.toHaveProperty('seats');
  const other = await request(path, 2);
  expect(other.body.table.cards.map((pair: unknown[]) => pair[1] !== null)).toEqual([false, false, true, false]);
  expect(other.body.table.actions).toEqual([]);
  expect((await request(path, 2, { kind: 'move', move: 'bet', revision: started.body.revision })).status).toBe(409);
  const command = { kind: 'move', move: 'bet', revision: started.body.revision };
  const results = await Promise.all([request(path, 0, command), request(path, 0, command)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect((await request(path, 1)).body.table).toMatchObject({ pot: 5, banks: [30, 31, 31, 31], turn: 1 });
  expect((await request(path, 0, undefined, 'https://unrelated.example.test')).status).toBe(403);
});

it('断线座位超时自动过牌或弃牌，重连仍回到原座位', async () => {
  const { request, advanceTime } = fixture();
  const created = await request('', 0, { size: 2, name: '甲' });
  const path = '/' + created.body.code;
  const guest = await request(path, 1, { kind: 'join', name: '乙' });
  const start = await request(path, 0, { kind: 'start', revision: guest.body.revision });
  advanceTime(6000);
  const second = await request(path, 1);
  expect(second.body.table).toMatchObject({ turn: 1, lastMove: { seat: 0, kind: 'check', timedOut: true } });
  expect((await request(path, 0, { kind: 'move', move: 'bet', revision: start.body.revision })).status).toBe(409);
  const bet = await request(path, 1, { kind: 'move', move: 'bet', revision: second.body.revision });
  expect(bet.body.table.turn).toBe(0);
  advanceTime(6000);
  const settled = await request(path, 1);
  expect(settled.body.table).toMatchObject({ phase: 'settled', lastMove: { seat: 0, kind: 'fold', timedOut: true } });
  const reconnect = await request(path, 0);
  expect(reconnect.body.seat).toBe(0);
  expect(reconnect.body.table.cards[0][1]).toEqual(start.body.table.cards[0][1]);
  advanceTime(25 * 60 * 60 * 1000);
  expect((await request(path, 1)).status).toBe(404);
});
