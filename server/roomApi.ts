import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_MOVES, ROOM_NAME_LENGTH, isRoomCode, type RoomView } from '../src/game/roomProtocol';
import {
  createRoomTable, nextRoomHand, roomActions, roomMove, roomTableView, swapRoomCard,
  type RoomTable, type SeatCount,
} from '../src/game/roomTable';

type Seat = { name: string; key: string };
export type RoomRecord = {
  code: string;
  size: SeatCount;
  seats: Seat[];
  table: RoomTable | null;
  revision: number;
  deadline: number | null;
};
export type StoredRoom = { room: RoomRecord; generation: number; expiresAt: number };
type MaybeAsync<T> = T | Promise<T>;
export type RoomStore = {
  get(code: string, now: number): MaybeAsync<StoredRoom | undefined>;
  byHost(key: string, now: number): MaybeAsync<StoredRoom | undefined>;
  insert(room: RoomRecord, expiresAt: number): MaybeAsync<boolean>;
  update(room: RoomRecord, generation: number, expiresAt: number): MaybeAsync<boolean>;
  remove?(code: string, generation: number): MaybeAsync<boolean>;
};

const ROOM_LIFETIME = 24 * 60 * 60 * 1000;
const DEFAULT_TURN = 60_000;
const BODY_LIMIT = 2048;
const STALE_ROOM = '牌桌刚刚更新，请稍后再操作。';

class RoomError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function fail(status: number, message: string): never {
  throw new RoomError(status, message);
}

function readName(value: unknown) {
  if (typeof value !== 'string') fail(400, '请填写称呼。');
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!name || [...name].length > ROOM_NAME_LENGTH || /[\p{Cc}\p{Cf}]/u.test(name)) {
    fail(400, '称呼须为 1 到 12 个可见字符。');
  }
  return name;
}

async function readKey(request: Request) {
  const authorization = request.headers.get('Authorization') ?? '';
  const raw = /^Bearer ([a-f0-9]{64})$/.exec(authorization)?.[1];
  if (!raw) fail(401, '缺少入座凭证。');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, '请发送 JSON。');
  const reader = request.body?.getReader();
  if (!reader) fail(400, '缺少请求内容。');
  const decoder = new TextDecoder();
  let length = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > BODY_LIMIT) {
      void reader.cancel();
      fail(413, '请求内容过长。');
    }
    text += decoder.decode(value, { stream: true });
  }
  let data: unknown;
  try {
    data = JSON.parse(text + decoder.decode());
  } catch {
    fail(400, '请求内容无法读取。');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, '请求内容格式不正确。');
  return data as Record<string, unknown>;
}

function publicRoom(room: RoomRecord, seat: number, now: number): RoomView {
  return {
    code: room.code, size: room.size, seat, players: room.seats.map(player => player.name),
    revision: room.revision, table: room.table ? roomTableView(room.table, seat) : null,
    deadline: room.deadline, serverTime: now,
  };
}

export function createRoomApi(store: RoomStore, options: {
  origins?: string[];
  random?: () => number;
  now?: () => number;
  turnMs?: number;
  ready?: () => MaybeAsync<void>;
} = {}) {
  const origins = new Set(options.origins);
  const random = options.random ?? (() => crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000);
  const now = options.now ?? Date.now;
  const turnMs = options.turnMs ?? DEFAULT_TURN;

  async function create(size: SeatCount, name: string, key: string, stamp: number) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await store.byHost(key, stamp);
      if (existing) return existing.room;
      const code = Array.from({ length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]).join('');
      const room = { code, size, seats: [{ name, key }], table: null, revision: 0, deadline: null };
      if (await store.insert(room, stamp + ROOM_LIFETIME)) return room;
    }
    fail(503, '暂时无法创建房间，请稍后重试。');
  }

  async function update(row: StoredRoom, room: RoomRecord, stamp: number) {
    const updated = await store.update(room, row.generation, stamp + ROOM_LIFETIME);
    if (!updated) fail(409, STALE_ROOM);
  }

  async function join(code: string, initial: StoredRoom, key: string, name: unknown, stamp: number) {
    let row: StoredRoom | undefined = initial;
    for (let attempt = 0; attempt < 4 && row; attempt++) {
      const { room } = row;
      const seat = room.seats.findIndex(player => player.key === key);
      if (seat >= 0) return publicRoom(room, seat, stamp);
      if (room.table || room.seats.length === room.size) fail(409, '房间已满或已经开局。');
      const nick = readName(name);
      if (room.seats.some(player => player.name.toLowerCase() === nick.toLowerCase())) fail(409, '这个称呼已被使用。');
      const joined = { ...room, seats: [...room.seats, { key, name: nick }], revision: room.revision + 1 };
      if (await store.update(joined, row.generation, stamp + ROOM_LIFETIME)) return publicRoom(joined, room.seats.length, stamp);
      row = await store.get(code, stamp);
    }
    fail(409, STALE_ROOM);
  }

  function withTable(room: RoomRecord, table: RoomTable, stamp: number): RoomRecord {
    return { ...room, table, revision: room.revision + 1, deadline: table.phase === 'playing' ? stamp + turnMs : null };
  }

  async function expireTurn(row: StoredRoom, stamp: number) {
    const { room } = row;
    if (!room.table || room.table.turn === null || room.deadline === null || room.deadline > stamp) return row;
    const seat = room.table.turn;
    const kind = roomActions(room.table, seat).some(action => action.kind === 'check') ? 'check' : 'fold';
    const table = roomMove(room.table, seat, kind, true);
    if (!table) return row;
    const updated = withTable(room, table, stamp);
    await update(row, updated, stamp);
    return { room: updated, generation: row.generation + 1, expiresAt: stamp + ROOM_LIFETIME };
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = !origin || origin === url.origin || origins.has(origin);
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' });
    if (allowed && origin) headers.set('Access-Control-Allow-Origin', origin);
    const reply = (data: object, status = 200) => Response.json(data, { status, headers });
    try {
      if (!allowed) fail(403, '此网页地址未获联机服务授权。');
      if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        headers.set('Access-Control-Max-Age', '600');
        return new Response(null, { status: 204, headers });
      }
      if (request.method === 'GET' && url.pathname === '/api/rooms/health') {
        await options.ready?.();
        return reply({ ok: true });
      }
      if (request.method !== 'GET' && request.method !== 'POST') fail(405, '不支持此请求方式。');
      const code = url.pathname.startsWith('/api/rooms/') ? url.pathname.slice('/api/rooms/'.length) : '';
      const creating = request.method === 'POST' && url.pathname === '/api/rooms';
      if (!creating && !isRoomCode(code)) fail(404, '房间不存在或已过期。');

      const key = await readKey(request);
      const data = request.method === 'POST' ? await readBody(request) : null;
      const stamp = now();
      if (creating && data) {
        const { size, name } = data;
        if (size !== 2 && size !== 4) fail(400, '请选择双人桌或四人桌。');
        return reply(publicRoom(await create(size, readName(name), key, stamp), 0, stamp), 201);
      }

      const stored = await store.get(code, stamp);
      if (!stored) fail(404, '房间不存在或已过期。');
      if (data?.kind === 'join') return reply(await join(code, stored, key, data.name, stamp));
      const seat = stored.room.seats.findIndex(player => player.key === key);
      if (seat < 0) fail(403, '当前浏览器尚未在此房间入座。');
      const row = await expireTurn(stored, stamp);
      const { room } = row;
      if (!data) return reply(publicRoom(room, seat, stamp));
      if (data.revision !== room.revision) fail(409, STALE_ROOM);

      if (data.kind === 'leave' && !room.table) {
        if (seat === 0) {
          if (!store.remove || !await store.remove(room.code, row.generation)) fail(409, '房间刚刚更新，请重试。');
        } else {
          await update(row, { ...room, seats: room.seats.filter((_, index) => index !== seat), revision: room.revision + 1 }, stamp);
        }
        return reply({ ok: true });
      }

      let table: RoomTable | null = null;
      if (data.kind === 'start' || data.kind === 'rematch') {
        if (seat !== 0) fail(403, '只有房主可以开局。');
        const canStart = data.kind === 'start' ? !room.table : room.table?.phase === 'finished';
        if (!canStart || room.seats.length !== room.size) fail(409, '座位还未坐齐，或牌局已经开始。');
        table = createRoomTable(room.size, random);
      } else if (room.table) {
        if (data.kind === 'next') table = nextRoomHand(room.table, random);
        if (data.kind === 'swap') table = swapRoomCard(room.table, seat);
        if (data.kind === 'move') {
          const kind = ROOM_MOVES.find(move => move === data.move);
          if (kind) table = roomMove(room.table, seat, kind);
        }
      }
      if (!table) fail(409, '当前无法进行这项操作。');
      const changed = data.kind === 'swap' ? { ...room, table } : withTable(room, table, stamp);
      await update(row, changed, stamp);
      return reply(publicRoom(changed, seat, stamp));
    } catch (error) {
      if (error instanceof RoomError) return reply({ error: error.message }, error.status);
      console.error('Room service failed', error instanceof Error ? error.name : 'UnknownError');
      return reply({ error: '联机服务暂时不可用，请稍后重试。' }, 503);
    }
  };
}
