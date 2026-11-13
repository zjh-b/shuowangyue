import { HINT_COUNT } from './hints';
import type { Match } from './match';
import { RULES, type Rule } from './rules';
import type { Session } from './session';

export type Judgment = {
  rule: Rule;
  hand: number;
  phase: Exclude<Match['phase'], 'finished'>;
  hintsUsed: number;
};
export type Judgments = { first: Judgment; latest: Judgment };

export function recordJudgment(session: Session, rule: Rule): Session {
  const { match, hints, judgments } = session;
  if (match.phase === 'finished') return session;
  const latest: Judgment = { rule, hand: match.hand, phase: match.phase, hintsUsed: hints.used };
  const prior = judgments?.latest;
  if (prior?.rule === rule && prior.hand === latest.hand && prior.phase === latest.phase && prior.hintsUsed === latest.hintsUsed) {
    return session;
  }
  return { ...session, judgments: { first: judgments?.first ?? latest, latest } };
}

function isJudgment(value: unknown): value is Judgment {
  return value !== null && typeof value === 'object'
    && 'rule' in value && RULES.some(rule => rule === value.rule)
    && 'hand' in value && typeof value.hand === 'number' && Number.isInteger(value.hand) && value.hand >= 0 && value.hand < 8
    && 'phase' in value && (value.phase === 'intro' || value.phase === 'playing' || value.phase === 'settled')
    && 'hintsUsed' in value && typeof value.hintsUsed === 'number' && Number.isInteger(value.hintsUsed)
    && value.hintsUsed >= 0 && value.hintsUsed <= HINT_COUNT;
}

export function restoreJudgments(value: unknown): Judgments | null {
  if (!value || typeof value !== 'object' || !('first' in value) || !('latest' in value)
    || !isJudgment(value.first) || !isJudgment(value.latest)) return null;
  return { first: value.first, latest: value.latest };
}
