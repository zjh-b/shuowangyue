import { CARDS, shuffled, type Card } from './cards';
import { pickClue, type Clue } from './clues';
import { unit, type ActionKind } from './match';
import { compareHands, RULES, type Rule } from './rules';

export const ROOM_HANDS = 8;
export const ROOM_BANK = 32;
export type SeatCount = 2 | 4;
type Pair = [Card, Card];
type PublicPair = [Card, Card | null];
export type RoomAction = { kind: ActionKind; cost: number };
export type RoomMove = RoomAction & { seat: number; timedOut?: true };
export type RoomHandRecord = {
  hand: number;
  publicCard: Card;
  cards: PublicPair[];
  winners: number[];
  awards: number[];
  banks: number[];
  pot: number;
  reason: 'fold' | 'showdown';
  moves: RoomMove[];
};
export type RoomTable = {
  size: SeatCount;
  rule: Rule;
  clue: Clue;
  hand: number;
  phase: 'playing' | 'settled' | 'finished';
  publicCard: Card;
  cards: Pair[];
  undealt: Card[];
  banks: number[];
  invested: number[];
  folded: boolean[];
  swapUsed: boolean[];
  discarded?: (Card | null)[];
  pot: number;
  raised: boolean;
  pending: number[];
  turn: number | null;
  moves: RoomMove[];
  history: RoomHandRecord[];
};

function seatOrder(size: SeatCount, from: number) {
  return Array.from({ length: size }, (_, offset) => (from + offset) % size);
}

function deal(size: SeatCount, hand: number, banks: number[], random: () => number) {
  const [publicCard, ...deck] = shuffled(CARDS, random);
  const first = hand % size;
  return {
    hand, publicCard,
    cards: Array.from({ length: size }, (_, seat): Pair => [deck[2 * seat], deck[2 * seat + 1]]),
    undealt: deck.slice(2 * size),
    banks: banks.map(chips => chips - 1),
    invested: Array<number>(size).fill(1),
    folded: Array<boolean>(size).fill(false),
    discarded: Array<Card | null>(size).fill(null),
    pot: size,
    raised: false,
    pending: seatOrder(size, first),
    turn: first,
    moves: [],
    phase: 'playing' as const,
  };
}

export function createRoomTable(size: SeatCount, random: () => number): RoomTable {
  const rule = RULES[Math.floor(random() * RULES.length)];
  return {
    size, rule, clue: pickClue(rule, random), history: [],
    swapUsed: Array<boolean>(size).fill(false),
    ...deal(size, 0, Array<number>(size).fill(ROOM_BANK), random),
  };
}

export function nextRoomHand(table: RoomTable, random: () => number): RoomTable | null {
  if (table.phase !== 'settled') return null;
  if (table.hand === ROOM_HANDS - 1) return { ...table, phase: 'finished' };
  return { ...table, ...deal(table.size, table.hand + 1, table.banks, random) };
}

export function roomActions(table: RoomTable, seat: number): RoomAction[] {
  if (table.phase !== 'playing' || table.turn !== seat) return [];
  const amount = unit(table);
  const due = Math.max(...table.invested) - table.invested[seat];
  const actions: RoomAction[] = due ? [
    { kind: 'fold', cost: 0 },
    { kind: 'call', cost: due },
    ...(!table.raised ? [{ kind: 'raise' as const, cost: due + amount }] : []),
  ] : [{ kind: 'check', cost: 0 }, { kind: 'bet', cost: amount }];
  return actions.filter(action => action.cost <= table.banks[seat]);
}

function canSwap(table: RoomTable, seat: number) {
  return table.phase === 'playing' && table.turn === seat && table.hand >= ROOM_HANDS / 2
    && !table.swapUsed[seat] && !table.moves.some(move => move.seat === seat);
}

export function swapRoomCard(table: RoomTable, seat: number): RoomTable | null {
  if (!canSwap(table, seat)) return null;
  const [replacement, ...undealt] = table.undealt;
  const cards = table.cards.map((pair, index): Pair => index === seat ? [pair[0], replacement] : pair);
  const discarded = (table.discarded ?? Array<Card | null>(table.size).fill(null))
    .map((value, index) => index === seat ? table.cards[seat][1] : value);
  return { ...table, cards, undealt, discarded, swapUsed: table.swapUsed.map((used, index) => used || index === seat) };
}

export function roomWinners(rule: Rule, publicCard: Card, players: { seat: number; cards: Pair }[]): number[] {
  let best = [players[0]];
  for (const player of players.slice(1)) {
    const { winner } = compareHands(rule, publicCard, player.cards, best[0].cards);
    if (winner === 0) best = [player];
    else if (winner === null) best.push(player);
  }
  return best.map(player => player.seat);
}

function settle(table: RoomTable, active: number[]): RoomTable {
  const reason = active.length === 1 ? 'fold' : 'showdown';
  const winners = reason === 'fold' ? active
    : roomWinners(table.rule, table.publicCard, active.map(seat => ({ seat, cards: table.cards[seat] })));
  const share = Math.floor(table.pot / winners.length);
  const remainder = table.pot % winners.length;
  const awards = table.banks.map((_, seat) => {
    const rank = winners.indexOf(seat);
    return rank < 0 ? 0 : share + Number(rank < remainder);
  });
  const banks = table.banks.map((chips, seat) => chips + awards[seat]);
  const cards = table.cards.map(([open, hole], seat): PublicPair => [open, reason === 'showdown' && !table.folded[seat] ? hole : null]);
  const record: RoomHandRecord = {
    hand: table.hand, publicCard: table.publicCard, cards, winners, awards, banks,
    pot: table.pot, reason, moves: table.moves,
  };
  return { ...table, banks, phase: 'settled', turn: null, pending: [], pot: 0, history: [...table.history, record] };
}

export function roomMove(table: RoomTable, seat: number, kind: ActionKind, timedOut = false): RoomTable | null {
  const action = roomActions(table, seat).find(choice => choice.kind === kind);
  if (!action) return null;
  const { cost } = action;
  const folded = table.folded.map((wasFolded, index) => wasFolded || (kind === 'fold' && index === seat));
  const active = seatOrder(table.size, table.hand % table.size).filter(index => !folded[index]);
  const reopened = kind === 'bet' || kind === 'raise';
  const pending = reopened
    ? seatOrder(table.size, (seat + 1) % table.size).filter(index => index !== seat && !folded[index])
    : table.pending.slice(1);
  const updated: RoomTable = {
    ...table, folded, pending, turn: pending[0] ?? null,
    raised: table.raised || kind === 'raise',
    banks: table.banks.map((chips, index) => index === seat ? chips - cost : chips),
    invested: table.invested.map((chips, index) => index === seat ? chips + cost : chips),
    pot: table.pot + cost,
    moves: [...table.moves, { seat, ...action, ...(timedOut && { timedOut: true }) }],
  };
  return active.length === 1 || pending.length === 0 ? settle(updated, active) : updated;
}

export function roomTableView(table: RoomTable, seat: number) {
  const published = table.phase === 'playing' ? undefined : table.history.at(-1);
  return {
    hand: table.hand, phase: table.phase, clue: table.clue,
    publicCard: table.publicCard,
    cards: table.cards.map(([open, hole], index): PublicPair => [open, index === seat ? hole : published?.cards[index][1] ?? null]),
    banks: table.banks, invested: table.invested, folded: table.folded,
    pot: table.pot, turn: table.turn, unit: unit(table), lastMove: table.moves.at(-1) ?? null,
    actions: roomActions(table, seat), canSwap: canSwap(table, seat), swapUsed: table.swapUsed[seat],
    discarded: table.discarded?.[seat] ?? null,
    history: table.history,
    rule: table.phase === 'finished' ? table.rule : null,
  };
}

export type RoomTableView = ReturnType<typeof roomTableView>;
