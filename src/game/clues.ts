import { card, type Card } from './cards';
import { compareHands, RULES, type Rule } from './rules';

export type Clue = { publicCard: Card; a: [Card, Card]; b: [Card, Card]; winner: 0 | 1 | null };
export const CLUES: Clue[] = [
  { publicCard: card('春节'), a: [card('重阳'), card('七夕')], b: [card('端午'), card('立夏')], winner: 0 },
  { publicCard: card('春节'), a: [card('中元'), card('除夕')], b: [card('元宵'), card('冬至')], winner: 0 },
  { publicCard: card('春节'), a: [card('元宵'), card('冬至')], b: [card('重阳'), card('七夕')], winner: 0 },
];
export const compatibleRules = (clue: Clue): Rule[] => RULES.filter(rule =>
  compareHands(rule, clue.publicCard, clue.a, clue.b).winner === clue.winner);
export function pickClue(rule: Rule, rng: () => number): Clue {
  const valid = CLUES.filter(c => compatibleRules(c).includes(rule));
  return valid[Math.floor(rng() * valid.length)];
}
