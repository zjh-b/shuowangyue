import { expect, it } from 'vitest';
import { card, makeRng } from '../src/game/cards';
import {
  createRoomTable, nextRoomHand, roomActions, roomMove, roomTableView, swapRoomCard,
  type RoomTable, type SeatCount,
} from '../src/game/roomTable';

it('四人开注与加注后，等待所有剩余玩家响应再结算', () => {
  let table = createRoomTable(4, makeRng(28));
  expect(roomActions(table, 1)).toEqual([]);
  table = roomMove(table, 0, 'bet')!;
  table = roomMove(table, 1, 'call')!;
  table = roomMove(table, 2, 'raise')!;
  expect(roomActions(table, 3)).toEqual([{ kind: 'fold', cost: 0 }, { kind: 'call', cost: 2 }]);
  table = roomMove(table, 3, 'fold')!;
  expect(table.turn).toBe(0);
  table = roomMove(table, 0, 'call')!;
  expect(table.phase).toBe('playing');
  expect(table.turn).toBe(1);
  table = roomMove(table, 1, 'call')!;
  expect(table.phase).toBe('settled');
  expect(table.history[0].pot).toBe(10);
  expect(table.history[0].cards.map(pair => pair[1] !== null)).toEqual([true, true, true, false]);
  expect(roomTableView(table, 0).cards[3][1]).toBeNull();
  expect(table.banks.reduce((sum, chips) => sum + chips, 0)).toBe(128);
});

it('无人跟注时直接收池，暗牌不会进入公开记录', () => {
  const initial = createRoomTable(2, makeRng(19));
  const bet = roomMove(initial, 0, 'bet')!;
  const result = roomMove(bet, 1, 'fold')!;
  expect(result.history[0]).toMatchObject({ winners: [0], reason: 'fold', pot: 3, banks: [33, 31] });
  expect(result.history[0].cards.every(pair => pair[1] === null)).toBe(true);
  expect(roomTableView(result, 1).cards[0][1]).toBeNull();
});

it('并列平分整道，奇数余筹按本手先手顺序发放', () => {
  const initial = createRoomTable(4, makeRng(21));
  const table: RoomTable = {
    ...initial, rule: 'large', hand: 1, turn: 1, pending: [1, 2, 3, 0],
    publicCard: card('春节'),
    cards: [
      [card('大暑'), card('白露')],
      [card('小寒'), card('立春')],
      [card('重阳'), card('元宵')],
      [card('中秋'), card('霜降')],
    ],
  };
  const checked = roomMove(table, 1, 'check')!;
  const bet = roomMove(checked, 2, 'bet')!;
  const call = roomMove(bet, 3, 'call')!;
  const raise = roomMove(call, 0, 'raise')!;
  const folded = roomMove(raise, 1, 'fold')!;
  const called = roomMove(folded, 2, 'call')!;
  const result = roomMove(called, 3, 'fold')!;
  expect(result.history[0]).toMatchObject({ winners: [2, 0], pot: 9, awards: [4, 0, 5, 0] });
});

it('后半场每座仅能在首次行动时私下换一次，牌不重复', () => {
  const random = makeRng(313);
  let table = createRoomTable(4, random);
  expect(swapRoomCard(table, 0)).toBeNull();
  for (let hand = 0; hand < 4; hand++) {
    while (table.phase === 'playing') table = roomMove(table, table.turn!, 'check')!;
    table = nextRoomHand(table, random)!;
  }
  expect(table.turn).toBe(0);
  const before = roomTableView(table, 1);
  const old = table.cards[0][1];
  table = swapRoomCard(table, 0)!;
  expect(table.cards[0][1]).not.toEqual(old);
  expect(roomTableView(table, 0).discarded).toEqual(old);
  expect(roomTableView(table, 1)).toEqual(before);
  expect(swapRoomCard(table, 0)).toBeNull();
  table = roomMove(table, 0, 'check')!;
  table = swapRoomCard(table, 1)!;
  expect(new Set([table.publicCard, ...table.cards.flat()].map(item => item.id)).size).toBe(9);
  expect(roomTableView(table, 1).swapUsed).toBe(true);
  while (table.phase === 'playing') table = roomMove(table, table.turn!, 'check')!;
  table = nextRoomHand(table, random)!;
  expect(table.turn).toBe(1);
  expect(swapRoomCard(table, 1)).toBeNull();
});

it.each([2, 4] as const)('%i 人桌随机合法路径打满八手，筹码始终守恒', count => {
  for (let seed = 0; seed < 64; seed++) {
    const random = makeRng(seed);
    let table = createRoomTable(count as SeatCount, random);
    for (let step = 0; table.phase !== 'finished'; step++) {
      expect(step).toBeLessThan(100);
      expect(table.banks.every(chips => Number.isInteger(chips) && chips >= 0)).toBe(true);
      expect(table.banks.reduce((total, chips) => total + chips, 0) + table.pot).toBe(count * 32);
      if (table.phase === 'settled') {
        table = nextRoomHand(table, random)!;
        expect(table.turn).toBe(table.phase === 'finished' ? null : table.hand % count);
        continue;
      }
      const turn = table.turn!;
      const choices = roomActions(table, turn);
      table = roomMove(table, turn, choices[Math.floor(random() * choices.length)].kind)!;
    }
    expect(table.history).toHaveLength(8);
    expect(table.banks.reduce((total, chips) => total + chips, 0)).toBe(count * 32);
  }
});
