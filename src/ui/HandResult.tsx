import { type Clue } from '../game/clues';
import { candidateResults } from '../game/hints';
import type { Rule } from '../game/rules';
import type { PublicRecord } from '../game/views';
import { RuleComparison, TABLE_SEATS } from './CluePanel';

export function HandResult({ entry, candidates }: { entry: PublicRecord; candidates: Rule[] }) {
  const [up, hole] = entry.cards[1];
  const verdict = entry.reason === 'showdown' ? entry.winner : entry.inspectionVerdict;
  const clue: Clue | undefined = hole && verdict !== undefined
    ? { publicCard: entry.publicCard, a: entry.cards[0], b: [up, hole], winner: verdict } : undefined;
  const distinguishes = clue && candidateResults(clue, candidates).some(result => result.winner !== clue.winner);
  const playerPaid = 1 + entry.moves.reduce((total, move) => total + (move.seat === 0 ? move.cost : 0), 0);
  const pot = 2 + entry.moves.reduce((total, move) => total + move.cost, 0);
  const net = (entry.winner === 0 ? pot : entry.winner === null ? pot / 2 : 0) - playerPaid;
  const remaining = entry.banks[0] - 32;

  return <div className="hand-result">
    <div className="hand-result-totals">
      <span>{entry.challenged ? '挑战净收益' : '本手净收益'} <strong className={net < 0 ? 'loss' : undefined}>{net > 0 ? '+' : ''}{net} 道</strong></span>
      <span>{remaining > 0 ? `领先起手 ${remaining} 道` : remaining < 0
        ? `距 32 道差 ${-remaining} 道` : '回到 32 道'}</span>
    </div>
    {entry.challenged && <p className="muted">你投入 {playerPaid} 道 · 摊牌底池 {pot} 道</p>}
    {distinguishes && clue && <details className="table-evidence" key={entry.hand}>
      <summary>{entry.reason === 'fold' ? '验牌可排除一种法则' : '这手可以排除一种法则'}</summary>
      <RuleComparison clue={clue} seats={TABLE_SEATS} rules={candidates} />
    </details>}
  </div>;
}
