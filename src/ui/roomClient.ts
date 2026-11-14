import { isRoomCode, normalizeRoomCode, type RoomCommand, type RoomView } from '../game/roomProtocol';
import type { SeatCount } from '../game/roomTable';

export const offlineRoomBuild = document.documentElement.hasAttribute('data-offline-build');
export const onlineGame = 'https://zjh-b.github.io/shuowangyue/';
const apiBase = (import.meta.env.VITE_ROOMS_API_URL ?? '').trim().replace(/\/+$/, '');
const apiPath = apiBase + '/api/rooms';
const storagePrefix = 'shuowangyue.rooms.';

export const inviteCode = (() => {
  const value = normalizeRoomCode(new URLSearchParams(location.search).get('room') ?? '');
  return isRoomCode(value) ? value : '';
})();

export function roomAddress(code = '') {
  const url = new URL(offlineRoomBuild ? onlineGame : location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(code ? 'room' : 'play', code || 'online');
  return url.href;
}

export function soloAddress() {
  const url = new URL(location.href);
  url.searchParams.delete('room');
  url.searchParams.delete('play');
  url.hash = '';
  return url.href;
}

export function createSeatKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export type RoomTicket = { code: string; key: string };

export function savedTicket(code?: string): RoomTicket | null {
  try {
    const value = code ?? localStorage.getItem(storagePrefix + 'latest');
    if (!value || !isRoomCode(value)) return null;
    const key = localStorage.getItem(storagePrefix + value);
    return key && /^[a-f0-9]{64}$/.test(key) ? { code: value, key } : null;
  } catch {
    return null;
  }
}

export function saveTicket(ticket: RoomTicket) {
  try {
    localStorage.setItem(storagePrefix + ticket.code, ticket.key);
    localStorage.setItem(storagePrefix + 'latest', ticket.code);
  } catch {
    // The active seat remains usable until this page is closed.
  }
}

export function removeTicket(code: string) {
  try {
    localStorage.removeItem(storagePrefix + code);
    if (localStorage.getItem(storagePrefix + 'latest') === code) localStorage.removeItem(storagePrefix + 'latest');
  } catch {
    // Local storage may be disabled in a private browsing context.
  }
}

export class RoomRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

type CreateRoom = { size: SeatCount; name: string };

async function roomRequest<T>(suffix: string, key?: string, payload?: CreateRoom | RoomCommand, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(9000);
  const response = await fetch(apiPath + suffix, {
    method: payload ? 'POST' : 'GET',
    headers: { Accept: 'application/json', ...(key && { Authorization: 'Bearer ' + key }),
      ...(payload && { 'Content-Type': 'application/json' }) },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    body: payload && JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new RoomRequestError(response.status, data?.error ?? '联机服务暂时不可用。');
  return data;
}

export const checkRoomService = (signal: AbortSignal) => roomRequest<{ ok: boolean }>('/health', undefined, undefined, signal);
export const createOnlineRoom = (size: SeatCount, name: string, key: string) => roomRequest<RoomView>('', key, { size, name });
export const getOnlineRoom = ({ code, key }: RoomTicket, signal?: AbortSignal) => roomRequest<RoomView>('/' + code, key, undefined, signal);
export const sendRoomCommand = <T = RoomView>({ code, key }: RoomTicket, command: RoomCommand) => roomRequest<T>('/' + code, key, command);
