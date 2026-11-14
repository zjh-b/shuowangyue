import { useRef } from 'react';
import { dateOf, digitsOf } from '../game/cards';
import { compatibleRules, type Clue } from '../game/clues';
import { candidateResults, HINT_COUNT, type EvidenceHint } from '../game/hints';
import { RULE_NAMES, scoreCards, type Rule } from '../game/rules';
import { PlayingCard } from './PlayingCard';

const HINT_TITLES = ['数字整理', '规则对照', '补充证据'];
const HINT_ACTIONS = ['第1次提示 · 整理数字', '第2次提示 · 对照规则', '第3次提示 · 揭晓法则'];
const HINT_DESCRIPTIONS = [
  '直接查看开局牌例两边的总点数、重数与顺子。',
  '把开局结果与三种法则逐一对照。',
  '用另一条判例确认本场法则，会揭开答案。',
];
const EXAMPLE_SEATS = ['甲', '乙'] as const;
export const TABLE_SEATS = ['你', '地猴'] as const;
type Seats = typeof EXAMPLE_SEATS | typeof TABLE_SEATS;

function verdict(winner: Clue['winner'], seats: Seats) {
  return winner === null ? '平局' : `${seats[winner]}胜`;
}

function ScoreSummary({ clue }: { clue: Clue }) {
  return <dl className="hint-scores">
    {([clue.a, clue.b] as const).map((cards, i) => {
      const score = scoreCards([clue.publicCard, ...cards]);
      return <div key={i}>
        <dt>{EXAMPLE_SEATS[i]}总点数 <strong>{score.sum}</strong></dt>
        <dd>{score.repeats}个{score.repeatedDigit} · {score.straight ? `顺子长${score.straight}` : '无顺子'} · 距24差{score.distance}</dd>
      </div>;
    })}
  </dl>;
}

export function RuleComparison({ clue, seats, rules }: { clue: Clue; seats: Seats; rules?: Rule[] }) {
  return <table className="hint-comparison">
    <thead><tr><th scope="col">候选法则</th><th scope="col">按法则会判</th><th scope="col">与结果相符</th></tr></thead>
    <tbody>{candidateResults(clue, rules).map(({ rule, winner, criterion }) => (
      <tr key={rule}>
        <th scope="row">{RULE_NAMES[rule]}</th>
        <td>{verdict(winner, seats)}<span className="hint-criterion">{criterion}</span></td>
        <td className={winner === clue.winner ? 'match-yes' : 'match-no'}>{winner === clue.winner ? '相符' : '排除'}</td>
      </tr>
    ))}</tbody>
  </table>;
}

export function OpeningExample({ clue }: { clue: Clue }) {
  return <section id="opening-example" aria-label="开局牌例" tabIndex={-1}>
    <div className="clue-public"><span>公共牌</span><strong>{clue.publicCard.name}</strong><span>{digitsOf(clue.publicCard).join(' · ')}</span></div>
    {([clue.a, clue.b] as const).map((cards, seat) => (
      <div className="example-side" key={seat}>
        <div className="example-seat">
          <span>{EXAMPLE_SEATS[seat]}</span>
          {clue.winner === seat && <strong>胜</strong>}
        </div>
        <div className="example-cards">{cards.map(c => <PlayingCard key={c.id} value={c} small />)}</div>
      </div>
    ))}
  </section>;
}

function Evidence({ evidence, opening }: { evidence: EvidenceHint; opening: Clue }) {
  const { clue, source } = evidence;
  const seats = source === 'example' ? EXAMPLE_SEATS : TABLE_SEATS;
  const candidates = compatibleRules(opening);
  const answer = candidateResults(clue, candidates).find(item => item.winner === clue.winner);
  return <>
    <p className="evidence-origin">{source === 'example' ? '补充判例'
      : `第${evidence.hand + 1}手${source === 'inspection' ? '验牌' : '摊牌'}`}</p>
    <dl className="evidence-cards">
      <div><dt>公共牌</dt><dd>{clue.publicCard.name} <span>{dateOf(clue.publicCard)}</span></dd></div>
      <div><dt>{seats[0]}</dt><dd>{clue.a.map(c => c.name).join('、')}</dd></div>
      <div><dt>{seats[1]}</dt><dd>{clue.b.map(c => c.name).join('、')}</dd></div>
    </dl>
    <p>{source === 'inspection' ? '按牌力判定' : '本例结果'} <b>{verdict(clue.winner, seats)}</b></p>
    <RuleComparison clue={clue} seats={seats} rules={candidates} />
    {answer && <p className="hint-answer">本场法则 <strong>{RULE_NAMES[answer.rule]}</strong></p>}
  </>;
}

export function CluePanel({ clue, used, evidence, finished, onHint, onReturn }: {
  clue: Clue; used: number; evidence?: EvidenceHint; finished: boolean; onHint: () => void; onReturn?: () => void;
}) {
  const remaining = HINT_COUNT - used;
  const canUse = remaining > 0 && !finished;
  const focusResult = useRef(false);

  function useHint() {
    focusResult.current = true;
    onHint();
  }

  function focusSummary(node: HTMLElement | null) {
    if (!node || !focusResult.current) return;
    node.focus();
    focusResult.current = false;
  }

  function openExample() {
    const example = document.getElementById('opening-example');
    example?.focus({ preventScroll: true });
    example?.scrollIntoView({ block: 'start' });
  }

  return <div className="clue-panel">
    <h2 id="clue-heading" tabIndex={-1}>开局留下一条线索</h2>
    <p className="muted">两种法则可以解释这条判例。牌例用牌已放回牌组。</p>

    <section className="hint-panel" aria-labelledby="hint-heading">
      <div className="hint-header">
        <h3 id="hint-heading" tabIndex={-1}>本场提示</h3>
        <span aria-live="polite">剩余 <strong>{remaining}</strong> / {HINT_COUNT}</span>
      </div>
      {canUse ? <>
        <p className="muted">{HINT_DESCRIPTIONS[used]}{used === 0 && '每档消耗1次提示，费用0道。'}</p>
        <button className="hint-action" onClick={useHint}>{HINT_ACTIONS[used]}</button>
      </> : <p className="muted">{finished ? '牌局已结束，完整判定见记录。' : '本场提示已用完，可以回看下方结果。'}</p>}
      <div className="hint-links">
        <button className="text-button" onClick={openExample}>查看开局牌例</button>
        {onReturn && <button className="text-button mobile-return" onClick={onReturn}>回到出牌</button>}
      </div>
      {used > 0 && <div className="hint-results">
        {HINT_TITLES.slice(0, used).map((title, index) => (
          <details key={title} open={index + 1 === used}>
            <summary ref={index + 1 === used ? focusSummary : undefined}>{title}</summary>
            <div className="hint-result-body">
              {index === 0 && <ScoreSummary clue={clue} />}
              {index === 1 && <>
                <p>开局结果 <b>{verdict(clue.winner, EXAMPLE_SEATS)}</b></p>
                <RuleComparison clue={clue} seats={EXAMPLE_SEATS} />
              </>}
              {index === 2 && evidence && <Evidence evidence={evidence} opening={clue} />}
            </div>
          </details>
        ))}
      </div>}
    </section>

    <OpeningExample clue={clue} />
  </div>;
}
