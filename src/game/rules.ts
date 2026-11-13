import { type Card, digitsOf } from './cards';

export const RULES = ['large', 'repeat', 'near'] as const;
export type Rule = typeof RULES[number];
export const RULE_NAMES: Record<Rule, string> = { large: '大数局', repeat: '重数局', near: '近数局' };
export type Score = { digits: number[]; sum: number; repeats: number; repeatedDigit: number; straight: number; distance: number };
export type Comparison = { winner: 0 | 1 | null; scores: [Score, Score]; criterion: string };

export function scoreCards(cards: Card[]): Score {
  const digits = cards.flatMap(digitsOf);
  const counts = Array<number>(10).fill(0);
  digits.forEach(d => counts[d]++);
  const sum = digits.reduce((a, b) => a + b, 0);
  const repeats = Math.max(...counts);
  let run = 0, longest = 0;
  for (const count of counts) {
    run = count ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { digits, sum, repeats, repeatedDigit: counts.lastIndexOf(repeats),
    straight: longest >= 3 ? longest : 0, distance: Math.abs(sum - 24) };
}

export function compareHands(rule: Rule, publicCard: Card, player: Card[], dealer: Card[]): Comparison {
  const scores: [Score, Score] = [scoreCards([publicCard, ...player]), scoreCards([publicCard, ...dealer])];
  const fields: [keyof Score, string, number][] = rule === 'large'
    ? [['sum', '总点数', 1], ['straight', '顺子长度', 1]]
    : rule === 'near'
      ? [['distance', '距24的距离', -1], ['straight', '顺子长度', 1]]
      : [['repeats', '重复次数', 1], ['repeatedDigit', '重复数字', 1], ['sum', '总点数', 1], ['straight', '顺子长度', 1]];
  for (const [field, label, direction] of fields) {
    const difference = ((scores[0][field] as number) - (scores[1][field] as number)) * direction;
    if (difference) return { winner: difference > 0 ? 0 : 1, scores, criterion: label };
  }
  return { winner: null, scores, criterion: '所有指标相同' };
}
