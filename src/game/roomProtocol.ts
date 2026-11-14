import type { ActionKind } from './match';
import type { RoomTableView, SeatCount } from './roomTable';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 8;
export const ROOM_NAME_LENGTH = 12;

export function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function isRoomCode(value: string) {
  return value.length === ROOM_CODE_LENGTH && [...value].every(letter => ROOM_CODE_ALPHABET.includes(letter));
}

export const ROOM_MOVES: readonly ActionKind[] = ['check', 'bet', 'call', 'raise', 'fold'];
export type RoomCommand = { kind: 'join'; name: string }
  | { kind: 'start' | 'next' | 'swap' | 'leave' | 'rematch'; revision: number }
  | { kind: 'move'; move: ActionKind; revision: number };

export type RoomView = {
  code: string;
  size: SeatCount;
  seat: number;
  players: string[];
  revision: number;
  table: RoomTableView | null;
  deadline: number | null;
  serverTime: number;
};
