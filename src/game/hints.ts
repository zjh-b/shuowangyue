import { CLUES, compatibleRules, type Clue } from './clues';
import { compareHands, RULES, type Rule } from './rules';
import type { PublicRecord } from './views';

export const HINT_COUNT = 3;

export type RuleEvidence = {
  source: 'showdown' | 'inspection';
  hand: number;
  clue: Clue;
};

export type EvidenceHint = RuleEvidence | {
  source: 'example';
  clue: Clue;
};

export function candidateResults(clue: Clue, rules: readonly Rule[] = RULES) {
  return rules.map(rule => {
    const { winner, criterion } = compareHands(rule, clue.publicCard, clue.a, clue.b);
    return { rule, winner, criterion };
  });
}

function rulesDisagree(clue: Clue, candidates: readonly Rule[]) {
  return candidateResults(clue, candidates).some(item => item.winner !== clue.winner);
}

export function firstRuleEvidence(opening: Clue, history: readonly PublicRecord[]): RuleEvidence | undefined {
  const candidates = compatibleRules(opening);
  for (const entry of history) {
    const [open, hole] = entry.cards[1];
    if (!hole) continue;
    const winner = entry.reason === 'showdown' ? entry.winner : entry.inspectionVerdict;
    if (winner === undefined) continue;
    const clue: Clue = { publicCard: entry.publicCard, a: entry.cards[0], b: [open, hole], winner };
    if (rulesDisagree(clue, candidates)) {
      return { source: entry.reason === 'showdown' ? 'showdown' : 'inspection', hand: entry.hand, clue };
    }
  }
}

export function evidenceForHint(opening: Clue, rule: Rule, history: readonly PublicRecord[]): EvidenceHint {
  const observed = firstRuleEvidence(opening, history);
  if (observed) return observed;
  const candidates = compatibleRules(opening);
  for (const example of CLUES) {
    const winner = compareHands(rule, example.publicCard, example.a, example.b).winner;
    const clue = { ...example, winner };
    if (rulesDisagree(clue, candidates)) return { source: 'example', clue };
  }
  throw new Error('开局候选规则缺少可区分的判例。');
}
