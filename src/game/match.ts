import { CARDS, makeRng, shuffled, type Card } from './cards';
import { type Clue, pickClue } from './clues';
import { compareHands, type Rule, RULES } from './rules';

export type Seat = 0 | 1;
export type ActionKind = 'check' | 'bet' | 'call' | 'raise' | 'fold';
export type Action = { kind: ActionKind; challenge?: boolean; token: string };
export type LegalAction = { kind: ActionKind; cost: number; challengeAllowed: boolean };
export type Move = { seat: Seat; kind: ActionKind; cost: number; challenge: boolean };
export type Hand = { publicCard: Card; cards: [[Card, Card], [Card, Card]] };
export type HoleSwap = { from: Card; to: Card };
export type RecordEntry = Hand & { hand: number; moves: Move[]; winner: Seat | null;
  reason: 'showdown' | 'fold'; inspected: boolean; challenged: boolean; banks: [number, number]; swap?: HoleSwap };
export type Match = {
  seed: number; rule: Rule; clue: Clue; deals: Hand[]; hand: number;
  phase: 'intro' | 'playing' | 'settled' | 'finished'; turn: Seat;
  banks: [number, number]; invested: [number, number]; pot: number;
  checks: number; moves: Move[]; history: RecordEntry[];
  challengeUsed: [boolean, boolean]; inspectUsed: boolean;
  holeSwap: { hand: number; replacement: Card } | null;
};
export const unit = (s: Match) => s.hand < 4 ? 1 : 2;
export const token = (s: Match) => `${s.seed}:${s.hand}:${s.phase}:${s.moves.length}:${s.holeSwap?.hand ?? '-'}`;

export function currentHand(s: Match): Hand {
  const original = s.deals[s.hand];
  return s.holeSwap?.hand === s.hand ? {
    publicCard: original.publicCard,
    cards: [[original.cards[0][0], s.holeSwap.replacement], original.cards[1]],
  } : original;
}

export function createMatch(seed: number, forcedRule?: Rule): Match {
  const rng = makeRng(seed);
  const rule = forcedRule ?? RULES[Math.floor(rng() * RULES.length)];
  const clue = pickClue(rule, rng);
  const deals = Array.from({ length: 8 }, (): Hand => {
    const [p, a, b, c, d] = shuffled(CARDS, rng);
    return { publicCard: p, cards: [[a, b], [c, d]] };
  });
  return { seed, rule, clue, deals, hand: 0, phase: 'intro', turn: 0, banks: [32, 32],
    invested: [0, 0], pot: 0, checks: 0, moves: [], history: [],
    challengeUsed: [false, false], inspectUsed: false, holeSwap: null };
}

function beginHand(s: Match): Match {
  return { ...s, phase: 'playing', turn: (s.hand % 2) as Seat,
    banks: [s.banks[0] - 1, s.banks[1] - 1], invested: [1, 1], pot: 2, checks: 0, moves: [] };
}
export function startMatch(s: Match): Match { return s.phase === 'intro' ? beginHand(s) : s; }
export function nextHand(s: Match): Match {
  if (s.phase !== 'settled') return s;
  if (s.hand === 7) return { ...s, phase: 'finished' };
  return beginHand({ ...s, hand: s.hand + 1 });
}

export function canSwapHole(s: Match): boolean {
  return s.phase === 'playing' && s.hand >= 4 && s.turn === 0
    && !s.holeSwap && !s.moves.some(move => move.seat === 0);
}

export function swapHole(s: Match): Match {
  if (!canSwapHole(s)) return s;
  const original = s.deals[s.hand];
  const dealt = new Set([original.publicCard, ...original.cards.flat()].map(card => card.id));
  const undealt = CARDS.filter(card => !dealt.has(card.id));
  // Draw independently so a swap never changes the dealer's roll or any future deal.
  const draw = makeRng(s.seed ^ Math.imul(s.hand + 1, 0x9e3779b1) ^ 0x6ed9eba1);
  const replacement = undealt[Math.floor(draw() * undealt.length)];
  return { ...s, holeSwap: { hand: s.hand, replacement } };
}

export function legalActions(s: Match): LegalAction[] {
  if (s.phase !== 'playing') return [];
  const due = Math.max(...s.invested) - s.invested[s.turn];
  const u = unit(s), max = 1 + 2 * u;
  const canChallenge = s.turn === 0 && !s.challengeUsed[s.hand < 4 ? 0 : 1];
  const choices: LegalAction[] = due ? [
    { kind: 'fold', cost: 0, challengeAllowed: false },
    { kind: 'call', cost: due, challengeAllowed: false },
    ...(Math.max(...s.invested) < max ? [{ kind: 'raise' as const, cost: due + u, challengeAllowed: canChallenge }] : []),
  ] : [
    { kind: 'check', cost: 0, challengeAllowed: false },
    { kind: 'bet', cost: u, challengeAllowed: canChallenge },
  ];
  return choices.filter(a => a.cost <= s.banks[s.turn]);
}

function settle(s: Match, reason: 'showdown' | 'fold', folded?: Seat): Match {
  const h = currentHand(s);
  const winner = folded === undefined ? compareHands(s.rule, h.publicCard, h.cards[0], h.cards[1]).winner : (1 - folded) as Seat;
  const banks: [number, number] = [...s.banks];
  if (winner === null) { banks[0] += s.pot / 2; banks[1] += s.pot / 2; }
  else banks[winner] += s.pot;
  const swap = s.holeSwap?.hand === s.hand
    ? { from: s.deals[s.hand].cards[0][1], to: s.holeSwap.replacement } : undefined;
  const entry: RecordEntry = { ...h, hand: s.hand, moves: s.moves, winner, reason,
    challenged: s.moves.some(m => m.challenge), inspected: false, banks, ...(swap && { swap }) };
  return { ...s, phase: 'settled', banks, pot: 0, history: [...s.history, entry] };
}

export function applyAction(state: Match, action: Action): Match {
  if (action.token !== token(state)) return state;
  const legal = legalActions(state).find(a => a.kind === action.kind);
  if (!legal || (action.challenge && !legal.challengeAllowed)) return state;
  const s: Match = { ...state, banks: [...state.banks], invested: [...state.invested],
    challengeUsed: [...state.challengeUsed], moves: [...state.moves] };
  s.banks[s.turn] -= legal.cost;
  s.invested[s.turn] += legal.cost;
  s.pot += legal.cost;
  s.moves.push({ seat: s.turn, kind: action.kind, cost: legal.cost, challenge: !!action.challenge });
  if (action.kind === 'fold') return settle(s, 'fold', s.turn);
  if (action.challenge) {
    s.challengeUsed[s.hand < 4 ? 0 : 1] = true;
    const payment = s.invested[0] - s.invested[1];
    s.banks[1] -= payment;
    s.invested[1] += payment;
    s.pot += payment;
    s.moves.push({ seat: 1, kind: 'call', cost: payment, challenge: false });
    return settle(s, 'showdown');
  }
  if (action.kind === 'call') return settle(s, 'showdown');
  if (action.kind === 'check') {
    s.checks++;
    if (s.checks === 2) return settle(s, 'showdown');
  }
  s.turn = (1 - s.turn) as Seat;
  return s;
}

export function inspectHand(s: Match): Match {
  const last = s.history.at(-1);
  if (s.phase !== 'settled' || s.inspectUsed || last?.reason !== 'fold') return s;
  return { ...s, inspectUsed: true, history: [...s.history.slice(0, -1), { ...last, inspected: true }] };
}
