import { useLayoutEffect, useRef, useState } from 'react';
import { digitsOf } from '../game/cards';
import { CLUES } from '../game/clues';
import { HINT_COUNT } from '../game/hints';
import { applyAction, createMatch, legalActions, startMatch, token, type Hand } from '../game/match';
import { compareHands, RULE_NAMES, RULES, scoreCards, type Rule } from '../game/rules';
import { playerView } from '../game/views';
import { RuleComparison } from './CluePanel';
import { outcome, RULE_COPY } from './gameCopy';
import { PlayingCard } from './PlayingCard';
import './onboarding.css';

const example = CLUES[0];
const practiceRule: Rule = 'large';
const practiceDeal: Hand = { publicCard: example.publicCard, cards: [example.a, example.b] };
const scoringCards = [example.publicCard, ...example.a];
const score = scoreCards(scoringCards);
const result = compareHands(practiceRule, example.publicCard, example.a, example.b);
const exampleSeats = ['你', '地猴'] as const;
const titles = ['入局规则', '读懂三张牌', '用判例排除规则', '挑战地猴'];

function practiceMatch() {
  const match = createMatch(0, practiceRule);
  return startMatch({ ...match, deals: [practiceDeal] });
}

function RuleIntro() {
  return <>
    <p className="onboarding-lead">双方各有 <b>32 道</b>，每手各付 1 道底注。打完八手，超过 32 道获胜，正好 32 道打平。</p>
    <section className="onboarding-rules" aria-label="三种候选法则">
      <p>每场随机选一套法则，八手沿用。双方都用自己的两张牌和公共牌计分。</p>
      <dl>
        {RULES.map(rule => <div key={rule}>
          <dt>{RULE_NAMES[rule]}</dt>
          <dd>{RULE_COPY[rule]}</dd>
        </div>)}
      </dl>
    </section>
    <p className="muted">地猴知道法则，也能看见你的底牌。每半场可随开注或加注挑战一次，迫使它跟注并摊牌。每场还有 {HINT_COUNT} 次免费提示。</p>
    <details className="onboarding-details">
      <summary>下注与验牌</summary>
      <p>无人下注时可以过牌或开注。面对下注可以跟注、加注或弃牌，每手最多加注一次。前四手下注单位为 1 道，后四手为 2 道。</p>
      <p>弃牌结算后、下一手开始前，可以验牌看假想摊牌结果。每场限一次，已经结算的筹码照旧。</p>
      <p>第5手起，每场可秘密换一次暗牌。轮到你首次行动时使用，地猴仍按旧牌下注。</p>
    </details>
  </>;
}

export function Onboarding({ entering, onClose, onEnter }: { entering: boolean; onClose: () => void; onEnter: () => void }) {
  const modal = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [counted, setCounted] = useState(false);
  const [compared, setCompared] = useState(false);
  const [practice, setPractice] = useState(practiceMatch);
  const view = playerView(practice);
  const challenge = legalActions(practice).find(action => action.challengeAllowed);
  const settled = practice.phase === 'settled';
  const ready = step === 0 || (step === 1 && counted) || (step === 2 && compared) || (step === 3 && settled);

  useLayoutEffect(() => {
    const dialog = modal.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useLayoutEffect(() => {
    body.current!.scrollTop = 0;
    heading.current!.focus({ preventScroll: true });
  }, [step]);

  useLayoutEffect(() => {
    if (ready && step > 0) feedback.current?.focus();
  }, [step, ready]);

  function makeChallenge() {
    if (!challenge) return;
    setPractice(current => applyAction(current, { kind: challenge.kind, challenge: true, token: token(current) }));
  }

  const forward = step === 0 ? '开始新手指导'
    : step === 3 ? (entering ? '完成指导并入局' : '完成指导') : '下一步';

  function advance() {
    if (step < 3) setStep(step + 1);
    else if (entering) onEnter();
    else onClose();
  }

  return <dialog className="onboarding" ref={modal} aria-labelledby="onboarding-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="onboarding-header">
      <h2 id="onboarding-title" ref={heading} tabIndex={-1}>{titles[step]}</h2>
      {step > 0 && <span className="onboarding-progress" aria-label={`新手指导，第${step}步，共3步`}>{step} / 3</span>}
      <button className="text-button onboarding-close" onClick={onClose}>关闭</button>
    </header>
    <div className="onboarding-body" ref={body}>
      {step === 0 && <RuleIntro />}
      {step === 1 && <>
        <p className="onboarding-lead">把日期逐位拆开。公共牌两边都用，你的明牌和暗牌只给你计分。</p>
        <div className="onboarding-hand">
          {scoringCards.map((card, index) => <PlayingCard key={card.id} value={card}
            label={['公共牌', '你的明牌', '你的暗牌'][index]} small />)}
        </div>
        <button className="secondary" onClick={() => setCounted(true)} disabled={counted}>计算总点数</button>
        <div className="onboarding-feedback" role="status" ref={feedback} tabIndex={-1}>
          {counted && <p>总点数 <b>{score.sum}</b> <span>{scoringCards.map(card => digitsOf(card).join(' + ')).join(' + ')}</span></p>}
        </div>
      </>}
      {step === 2 && <>
        <p className="onboarding-lead">同一组牌在不同法则下可能有不同胜负。用已经公布的结果排除候选。</p>
        <dl className="onboarding-example">
          <div><dt>公共牌</dt><dd>{example.publicCard.name}</dd></div>
          <div><dt>你的牌</dt><dd>{example.a.map(card => card.name).join('、')}</dd></div>
          <div><dt>地猴的牌</dt><dd>{example.b.map(card => card.name).join('、')}</dd></div>
        </dl>
        <p className="onboarding-result">练习判例结果 <b>你胜</b></p>
        <button className="secondary" onClick={() => setCompared(true)} disabled={compared}>试用规则对照</button>
        {compared && <div className="onboarding-comparison" ref={feedback} tabIndex={-1} aria-label="规则对照结果">
          <RuleComparison clue={example} seats={exampleSeats} />
          <p className="muted">本例排除近数局。正式对局也可用提示核对开局判例。</p>
        </div>}
      </>}
      {step === 3 && <>
        <p className="onboarding-lead">练习手使用<b>{RULE_NAMES[practiceRule]}</b>。开注时发起挑战，地猴就必须跟注，双方随即摊牌。</p>
        <div className="onboarding-hand">
          <PlayingCard value={view.cards[1][0]} label="地猴明牌" small />
          <PlayingCard value={view.cards[1][1]} label="地猴暗牌" small />
        </div>
        {challenge && <button className="challenge-button" onClick={makeChallenge}>挑战并开注 · {challenge.cost}道</button>}
        <div className="onboarding-feedback" role="status" ref={feedback} tabIndex={-1}>
          {settled && <p>地猴跟注，双方摊牌。<b>{outcome(view.history[0].winner)}</b>
            <span>你的总点数 {result.scores[0].sum} · 地猴 {result.scores[1].sum}</span></p>}
        </div>
        <p className="muted">练习单独结算，正式牌局保留原有筹码、提示和挑战额度。</p>
      </>}
    </div>
    <footer className="onboarding-footer">
      {!(step === 3 && ready) && (entering
        ? <button className="text-button" onClick={onEnter}>{step === 0 ? '直接开始' : '跳过指导并入局'}</button>
        : <button className="text-button" onClick={onClose}>返回规则册</button>)}
      <button className="primary" onClick={advance} disabled={!ready}>{forward}</button>
    </footer>
  </dialog>;
}
