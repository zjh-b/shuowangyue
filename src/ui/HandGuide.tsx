import { useId, useMemo, useState } from 'react';
import { callThreshold, handOutlook, swapOutlook, type HandKnowledge } from '../game/handOutlook';
import { RULE_NAMES, RULES, type Rule } from '../game/rules';
import './handGuide.css';

type Props = HandKnowledge & {
  rule: Rule | null;
  onRuleChange: (rule: Rule) => void;
  pot: number;
  callCost: number;
  canAct: boolean;
  canSwap: boolean;
  challenge?: { cost: number; finalPot: number };
};

const percentage = (value: number) => (value * 100).toFixed(1) + '%';

export function HandGuide({ rule, onRuleChange, pot, callCost, canAct, canSwap, challenge, ...information }: Props) {
  const [open, setOpen] = useState(false);
  const selectId = useId();
  const cardsKey = [information.publicCard.id, ...information.mine.map(item => item.id),
    ...information.opponents.map(player => player.upcard.id + Number(player.active)), information.discarded?.id].join('|');
  const outlook = useMemo(() => open && rule ? handOutlook(rule, information) : null, [open, rule, cardsKey]);
  const swap = useMemo(() => open && rule && canSwap ? swapOutlook(rule, information) : null, [open, rule, cardsKey, canSwap]);
  const threshold = callThreshold(pot, callCost);

  return <details className="hand-guide" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span>按我的判断看本手</span>{rule && <span className="guide-selected-rule">{RULE_NAMES[rule]}</span>}</summary>
    {open && <section className="hand-guide-body" aria-label="本手估牌">
      <label className="guide-rule" htmlFor={selectId}>估牌法则
        <select id={selectId} value={rule ?? ''} onChange={event => {
          const selected = RULES.find(item => item === event.target.value);
          if (selected) onRuleChange(selected);
        }}>
          <option value="" disabled>选一套你推测的法则</option>
          {RULES.map(item => <option key={item} value={item}>{RULE_NAMES[item]}</option>)}
        </select>
      </label>
      {outlook ? <>
        <p className="guide-score">本手总点 <b>{outlook.score.sum}</b>
          {rule === 'near' && <> · 距24差 <b>{outlook.score.distance}</b></>}
          {rule === 'repeat' && <> · <b>{outlook.score.repeats}</b> 个 <b>{outlook.score.repeatedDigit}</b></>}
          {' · '}{outlook.score.straight ? `最长顺子 ${outlook.score.straight}` : '无顺子'}
        </p>
        <dl className="guide-outcomes" aria-label="整桌牌力估算">
          <div><dt>领先</dt><dd>{percentage(outlook.wins / outlook.cases)}</dd></div>
          <div><dt>并列第一</dt><dd>{percentage(outlook.ties / outlook.cases)}</dd></div>
          <div><dt>落后</dt><dd>{percentage(outlook.losses / outlook.cases)}</dd></div>
        </dl>
        <p className="guide-equity">计入平分，底池份额估算 <strong>{percentage(outlook.equity)}</strong>。</p>
        {canAct && <p className="guide-cost">{threshold === null ? '当前可以免费过牌。'
          : <>跟注补 <b>{callCost} 道</b>，按当前底池 {pot} 道，回本门槛为 <b>{percentage(threshold)}</b> 的底池份额。后续下注会改变门槛。</>}</p>}
        {challenge && <p className="guide-cost">挑战投入 <b>{challenge.cost} 道</b> 后，地猴跟注，最终底池 <b>{challenge.finalPot} 道</b>。</p>}
        {swap && <div className="guide-swap">
          <p>换牌后，自身牌力 <b>提升 {percentage(swap.improves / swap.cases)}</b>
            {' · '}持平 {percentage(swap.same / swap.cases)} · 下降 {percentage(swap.worsens / swap.cases)}。</p>
          <p className="muted">每场仅有一次换牌机会，可留到后面的手。</p>
        </div>}
        <p className="muted guide-method">假设你选的法则成立，未见暗牌等可能，按仍在牌局中的对手一起摊牌估算。下注行为和后续换牌会影响实际结果。</p>
      </> : <p className="muted">选择你推测的法则，再查看本手牌力。</p>}
    </section>}
  </details>;
}
