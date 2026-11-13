import { makeRng } from './cards';
import { legalActions, type Hand, type LegalAction, type ActionKind, type Match, type Move } from './match';
import { compareHands, type Rule } from './rules';

export type DealerView = Hand & { rule: Rule; publicMoves: Move[] };

export function dealerAction(match: Match): ActionKind {
  const rng = makeRng(match.seed ^ ((match.hand + 1) * 7919) ^ (match.moves.length * 101));
  return chooseDealerAction({ ...match.deals[match.hand], rule: match.rule, publicMoves: match.moves }, legalActions(match), rng);
}
export function chooseDealerAction(view: DealerView, legal: LegalAction[], rng: () => number): ActionKind {
  const result = compareHands(view.rule, view.publicCard, view.cards[0], view.cards[1]);
  const ahead = result.winner === 1, tied = result.winner === null;
  const roll = rng();
  const has = (kind: ActionKind) => legal.some(a => a.kind === kind);
  if (has('check')) return (ahead ? roll < 0.7 : !tied && roll < 0.28) ? 'bet' : 'check';
  if (ahead) return has('raise') && roll < 0.42 ? 'raise' : 'call';
  if (tied) return 'call';
  return has('raise') && roll < 0.18 ? 'raise' : 'fold';
}
