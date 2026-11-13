import type { ActionKind, Move } from '../game/match';
import type { Rule } from '../game/rules';

export const ACTION_NAMES: Record<ActionKind, string> = {
  check: '过牌', bet: '开注', call: '跟注', raise: '加注', fold: '弃牌',
};

export const RULE_COPY: Record<Rule, string> = {
  large: '先比总点数，较大者胜。同分再比最长顺子。',
  repeat: '各取出现次数最多的数字，有多个时取其中最大的。先比出现次数，再比该数字、总点数和最长顺子。',
  near: '总点数离24越近越强，超过24也有效。距离相同再比最长顺子。',
};

export function moveText(move: Move): string {
  return `${move.seat === 0 ? '你' : '地猴'}${move.challenge ? '挑战并' : ''}${ACTION_NAMES[move.kind]}${move.cost ? ` ${move.cost}道` : ''}`;
}

export function outcome(winner: 0 | 1 | null) {
  return winner === null ? '双方平局' : winner === 0 ? '你胜' : '地猴胜';
}
