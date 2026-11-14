import { useRef } from 'react';
import { compatibleRules } from '../game/clues';
import { canSwapHole, legalActions, unit, type ActionKind, type Match } from '../game/match';
import { firstRuleEvidence, HINT_COUNT } from '../game/hints';
import type { SessionEvent } from '../game/session';
import type { playerView } from '../game/views';
import type { Rule } from '../game/rules';
import { ACTION_NAMES, moveText, outcome } from './gameCopy';
import { HandResult } from './HandResult';
import { HandGuide } from './HandGuide';
import { PlayingCard } from './PlayingCard';

type Props = {
  match: Match;
  view: ReturnType<typeof playerView>;
  hintsLeft: number;
  onClue: () => void;
  onAdvance: () => void;
  dispatch: (event: SessionEvent) => void;
  judgment: Rule | null;
  onJudgment: (rule: Rule) => void;
};

export function MatchTable({ match, view, hintsLeft, onClue, onAdvance, dispatch, judgment, onJudgment }: Props) {
  const choices = match.turn === 0 ? legalActions(match) : [];
  const challenges = choices.filter(action => action.challengeAllowed);
  const last = view.history.at(-1);
  const lastMove = match.moves.at(-1);
  const half = match.hand < 4 ? 0 : 1;
  const swapAvailable = canSwapHole(match);
  const firstPlayerMove = !match.moves.some(move => move.seat === 0);
  const swap = match.holeSwap?.hand === match.hand ? match.holeSwap : null;
  const swapStatus = useRef<HTMLParagraphElement>(null);
  const reveal = match.phase === 'settled' && last?.reason === 'showdown'
    && (last.challenged || last.swap || match.hand === 7);
  const candidates = hintsLeft === 0 || firstRuleEvidence(match.clue, view.history.slice(0, -1))
    ? [] : compatibleRules(match.clue);
  const awaitingPlayer = match.phase === 'playing' && match.turn === 0;
  const awaitingDealer = match.phase === 'playing' && match.turn === 1;
  const play = (kind: ActionKind, challenge = false) => dispatch({ type: 'move', seat: 0, kind, challenge });

  function replaceHole() {
    dispatch({ type: 'swap' });
    requestAnimationFrame(() => swapStatus.current?.focus({ preventScroll: true }));
  }

  return <section className="table-section" aria-label="牌桌">
    <div className="table-heading">
      <div className="table-round">
        <h1 id="match-heading" tabIndex={-1}>第 <strong>{match.hand + 1}</strong> / 8 手</h1>
        <ol className="hand-progress" aria-label="八手进度">
          {match.deals.map((_, hand) => (
            <li key={hand} aria-current={hand === match.hand ? 'step' : undefined}
              data-complete={hand < match.hand || (hand === match.hand && match.phase === 'settled')}>
              <span className="sr-only">第{hand + 1}手{hand < match.hand || (hand === match.hand && match.phase === 'settled') ? '，已结束' : ''}</span>
            </li>
          ))}
        </ol>
      </div>
      <span>下注单位 {unit(match)}道 <span className="table-limit">· 至多加注一次</span></span>
    </div>
    <div className="felt">
      <div className={`table-band dealer-band${awaitingDealer ? ' active-seat' : ''}`}>
        <div className="seat-header"><h2>地猴</h2><p><strong>{match.banks[1]}</strong> 道</p><span>知晓法则 · 透视发牌</span></div>
        <div className={`hand-row${reveal ? ' showdown-reveal' : ''}`}>
          <PlayingCard value={view.cards[1][0]} label="明牌" />
          <PlayingCard value={view.cards[1][1]} label="暗牌" />
        </div>
      </div>
      <div className="table-band public-band">
        <div className="pool"><span>底池</span><strong data-testid="pot">{match.pot}</strong><span>道</span></div>
        <PlayingCard value={view.publicCard} label="公共牌" />
      </div>
      <div className={`table-band player-band${awaitingPlayer ? ' active-seat' : ''}`}>
        <div className="seat-header"><h2>你</h2><p><strong data-testid="player-bank">{match.banks[0]}</strong> 道</p>
          <span>{match.phase === 'playing' ? `本手已投入 ${match.invested[0]}道` : '本手已结算'}</span>
        </div>
        <div className={`hand-row${swap ? ' swapped-hand' : ''}`}>
          <PlayingCard value={view.cards[0][0]} label="你的明牌" />
          <PlayingCard key={view.cards[0][1].id} value={view.cards[0][1]} label={swap ? '你的新暗牌' : '你的暗牌'} />
        </div>
      </div>
    </div>
    <div className={`action-area${awaitingPlayer ? ' action-ready' : ''}`} id="table-actions" tabIndex={-1}>
      <div className="action-heading">
        <div className="turn-status" role="status">
          {match.phase === 'settled' && last ? <>
            <strong>{last.winner === null ? '平分底池' : last.winner === 0 ? '你拿下底池' : '地猴拿下底池'}</strong>
            <span>{last.reason === 'fold' ? '本手按弃牌结算。' : last.challenged ? '挑战成立，地猴跟注后摊牌。' : '双方摊牌，结果已记入牌局记录。'}</span>
          </> : <>
            <strong>{match.turn === 0 ? '轮到你了' : '地猴正在思量…'}</strong>
            <span>{lastMove ? moveText(lastMove) : match.turn === 0 ? '你先行动，可以过牌或开注。' : '本手地猴先行动。'}</span>
          </>}
        </div>
        <button className="hint-jump" onClick={onClue}>提示 <span>{hintsLeft} / {HINT_COUNT}</span></button>
      </div>
      {match.phase === 'playing' && <>
        <div className="action-buttons">{choices.map(({ kind, cost }) => (
          <button key={kind} className={kind === 'fold' || kind === 'check' ? 'secondary' : 'primary'} onClick={() => play(kind)}>
            {ACTION_NAMES[kind]}{cost ? ` · ${kind === 'call' ? '补' : ''}${cost}道` : ''}
          </button>
        ))}</div>
        <div className={`tactical-row${half === 1 ? ' tactical-row-paired' : ''}`}>
          <div className="challenge-row">
            {challenges.length > 0 ? challenges.map(({ kind, cost }) => (
              <button className="challenge-button" aria-describedby="challenge-description" key={kind} onClick={() => play(kind, true)}>
                挑战并{ACTION_NAMES[kind]} · {cost}道
              </button>
            )) : <span>{match.challengeUsed[half] ? '本半场挑战已使用' : '本半场挑战剩余1次'}</span>}
            <p id="challenge-description" className="muted">
              {match.hand === 4 && !match.challengeUsed[half] ? '次数已刷新 · 地猴须跟注并摊牌' : '挑战令地猴跟注并摊牌'}
            </p>
          </div>
          {half === 1 && <div className="swap-row">
            {swapAvailable && <button className="challenge-button swap-button" aria-describedby="swap-description" onClick={replaceHole}>秘密换暗牌 · 1次</button>}
            <p id="swap-description" className="muted" ref={swapStatus} tabIndex={-1} aria-live="polite">
              {swap ? `已将 ${match.deals[match.hand].cards[0][1].name} 换为 ${swap.replacement.name}。地猴仍看到旧牌。`
                : match.holeSwap ? '本场换牌机会已用。'
                  : swapAvailable ? '随机换牌。地猴按旧牌下注。'
                    : firstPlayerMove ? '换牌机会剩 1 次。等轮到你时可用。' : '换牌机会剩 1 次，可留到后面的手。'}
            </p>
          </div>}
        </div>
      </>}
      {match.phase === 'settled' && last && <>
        {last.swap && <p className="swap-settled muted">已秘密换牌 · {last.swap.from.name} → {last.swap.to.name}</p>}
        <HandResult key={match.hand} entry={last} candidates={candidates} />
        <div className="settled-buttons">
          {last.reason === 'fold' && !match.inspectUsed &&
            <button className="secondary" onClick={() => dispatch({ type: 'inspect' })}>验牌 · 全场1次</button>}
          <button className="primary" onClick={onAdvance}>{match.hand === 7 ? '揭晓法则与复盘' : '下一手'}</button>
        </div>
        {last.inspectionVerdict !== undefined &&
          <p className="inspection-result">验牌 · 假想摊牌{outcome(last.inspectionVerdict)}。筹码仍按弃牌结算。</p>}
      </>}
    </div>
    {match.phase === 'playing' && <HandGuide publicCard={view.publicCard} mine={view.cards[0]}
      opponents={[{ upcard: view.cards[1][0], active: true }]}
      discarded={swap ? match.deals[match.hand].cards[0][1] : null}
      rule={judgment} onRuleChange={onJudgment} pot={match.pot}
      callCost={choices.find(choice => choice.kind === 'call')?.cost ?? 0}
      canAct={awaitingPlayer} canSwap={swapAvailable}
      challenge={challenges[0] && {
        cost: challenges[0].cost,
        finalPot: match.pot + 2 * challenges[0].cost + match.invested[0] - match.invested[1],
      }} />}
  </section>;
}
