import { useState } from 'react';
import { compatibleRules } from '../game/clues';
import { candidateResults } from '../game/hints';
import type { Judgment, Judgments } from '../game/judgments';
import { judgmentTiming, playtestRecord, playtestReview } from '../game/playtest';
import { RULE_NAMES, RULES, type Rule } from '../game/rules';
import type { Session } from '../game/session';
import { outcome } from './gameCopy';

function JudgmentLine({ judgment }: { judgment: Judgment }) {
  return <>{RULE_NAMES[judgment.rule]}<small>{judgmentTiming(judgment)} · 已用提示 {judgment.hintsUsed} 次</small></>;
}

export function JudgmentForm({ judgments, finished, onSave }: {
  judgments: Judgments | null; finished: boolean; onSave: (rule: Rule) => void;
}) {
  const [choice, setChoice] = useState<Rule | ''>(judgments?.latest.rule ?? '');
  return <section className="judgment-form" aria-label="记录当前判断">
    {!finished && <form onSubmit={event => { event.preventDefault(); if (choice) onSave(choice); }}>
      <label htmlFor="judgment">当前判断</label>
      <div>
        <select id="judgment" value={choice} onChange={event => setChoice(RULES.find(rule => rule === event.target.value) ?? '')}>
          <option value="">选择一套法则</option>
          {RULES.map(rule => <option key={rule} value={rule}>{RULE_NAMES[rule]}</option>)}
        </select>
        <button className="secondary" type="submit" disabled={!choice}>记录判断</button>
      </div>
    </form>}
    <p className="muted" aria-live="polite">{judgments
      ? `已记录 ${RULE_NAMES[judgments.latest.rule]} · ${judgmentTiming(judgments.latest)} · 已用提示 ${judgments.latest.hintsUsed} 次`
      : finished ? '本场没有记录判断。' : '有把握时记下一次判断，局后可回看你何时选定规则。'}</p>
  </section>;
}

function downloadRecord(session: Session) {
  const record = playtestRecord(session);
  if (!record) return;
  const file = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = '朔望月-试玩记录.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PlaytestReview({ session, onEvidence }: { session: Session; onEvidence: (hand: number) => void }) {
  const { judgments, evidence, hintsUsed, hintSource, showdowns, challengeHands, swapHand } = playtestReview(session);
  const changed = judgments && (judgments.first.rule !== judgments.latest.rule || judgments.first.hand !== judgments.latest.hand
      || judgments.first.phase !== judgments.latest.phase || judgments.first.hintsUsed !== judgments.latest.hintsUsed);
  const rejected = evidence && candidateResults(evidence.clue, compatibleRules(session.match.clue))
    .find(candidate => candidate.winner !== evidence.clue.winner);
  return <section className="playtest-review" aria-label="推理复盘">
    <h2>推理复盘</h2>
    <dl>
      <div><dt>{changed ? '首次判断' : '你的判断'}</dt><dd>{judgments ? <JudgmentLine judgment={judgments.first} /> : '本场未记录'}</dd></div>
      {changed && <div><dt>最后判断</dt><dd><JudgmentLine judgment={judgments.latest} /></dd></div>}
      <div>
        <dt>最早区分规则的牌例</dt>
        <dd>{evidence ? <>
          <button className="text-button" onClick={() => onEvidence(evidence.hand)}>
            第{evidence.hand + 1}手{evidence.source === 'showdown' ? '摊牌' : '验牌'}
          </button>
          {rejected && <small>已公布：{outcome(evidence.clue.winner)}。按{RULE_NAMES[rejected.rule]}会判{outcome(rejected.winner)}。</small>}
        </> : '本场没有足以区分规则的公开牌例'}</dd>
      </div>
      <div><dt>本场操作</dt><dd>摊牌 {showdowns} 手 · 提示 {hintsUsed} 次
        <small>{challengeHands.length ? `挑战 ${challengeHands.length} 次 · 第${challengeHands.join('、')}手` : '挑战 0 次'}</small>
        {swapHand && <small>第{swapHand}手秘密换牌</small>}
        {hintSource === 'example' && <small>第3次提示给出了补充判例</small>}
      </dd></div>
    </dl>
    <button className="text-button export-playtest" onClick={() => downloadRecord(session)}>下载试玩记录</button>
  </section>;
}
