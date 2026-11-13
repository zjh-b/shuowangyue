import { CARDS, type Card } from './cards';
import { compatibleRules, type Clue } from './clues';
import { dealerAction } from './dealer';
import { firstRuleEvidence } from './hints';
import {
  applyAction, createMatch, legalActions, nextHand, startMatch, token,
  type ActionKind, type LegalAction, type Match, type Move,
} from './match';
import { compareHands, type Rule } from './rules';
import { playerView, type PublicRecord } from './views';

export const STRATEGIES = ['fold', 'passive', 'follow', 'evidence'] as const;
export type Strategy = typeof STRATEGIES[number];

type PlayerContext = {
  publicCard: Card;
  cards: [Card, Card];
  dealerUpcard: Card;
  opening: Clue;
  history: PublicRecord[];
  moves: Move[];
  legal: LegalAction[];
};

function estimatedWinShare({ publicCard, cards, dealerUpcard, opening, history }: PlayerContext) {
  const candidates = compatibleRules(opening);
  const evidence = firstRuleEvidence(opening, history)?.clue;
  const rules = evidence
    ? candidates.filter(rule => compareHands(rule, evidence.publicCard, evidence.a, evidence.b).winner === evidence.winner)
    : candidates;
  const visible = [publicCard, ...cards, dealerUpcard];
  const possible = CARDS.filter(card => !visible.includes(card));
  let shares = 0;
  for (const rule of rules) {
    for (const hole of possible) {
      const { winner } = compareHands(rule, publicCard, cards, [dealerUpcard, hole]);
      shares += winner === 0 ? 1 : winner === null ? 0.5 : 0;
    }
  }
  return shares / (rules.length * possible.length);
}

function playerAction(strategy: Strategy, context: PlayerContext): { kind: ActionKind; challenge?: boolean } {
  const { legal, moves } = context;
  const has = (kind: ActionKind) => legal.some(action => action.kind === kind);
  const passive = has('check') ? 'check' : 'call';
  if (strategy === 'fold') return { kind: has('fold') ? 'fold' : 'check' };
  if (strategy === 'passive') return { kind: passive };
  if (strategy === 'follow') {
    if (has('fold')) return { kind: 'fold' };
    return { kind: moves.at(-1)?.seat === 1 && has('bet') ? 'bet' : 'check' };
  }
  const share = estimatedWinShare(context);
  const challenge = legal.find(action => action.challengeAllowed);
  if (challenge && share >= 0.7) return { kind: challenge.kind, challenge: true };
  if (has('check')) return { kind: share >= 0.6 && has('bet') ? 'bet' : 'check' };
  return { kind: share >= 0.45 && has('call') ? 'call' : 'fold' };
}

export function simulateMatch(seed: number, rule: Rule, strategy: Strategy): Match {
  let match = startMatch(createMatch(seed, rule));
  while (match.phase !== 'finished') {
    if (match.phase === 'settled') {
      match = nextHand(match);
      continue;
    }
    const action = match.turn === 1 ? { kind: dealerAction(match) } : playerActionForMatch(strategy, match);
    const updated = applyAction(match, { ...action, token: token(match) });
    if (updated === match) throw new Error(`策略 ${strategy} 提交了非法动作 ${action.kind}`);
    match = updated;
  }
  return match;
}

function playerActionForMatch(strategy: Strategy, match: Match) {
  const view = playerView(match);
  return playerAction(strategy, {
    publicCard: view.publicCard,
    cards: view.cards[0],
    dealerUpcard: view.cards[1][0],
    opening: match.clue,
    history: view.history,
    moves: match.moves,
    legal: legalActions(match),
  });
}
