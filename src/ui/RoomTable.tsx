import { useEffect, useState } from 'react';
import { digitsOf, type Card } from '../game/cards';
import { compatibleRules } from '../game/clues';
import type { RoomCommand, RoomView } from '../game/roomProtocol';
import { ROOM_BANK, ROOM_HANDS, roomWinners, type RoomHandRecord, type RoomMove } from '../game/roomTable';
import { RULE_NAMES, RULES, type Rule } from '../game/rules';
import { OpeningExample, RuleComparison } from './CluePanel';
import { ACTION_NAMES, RULE_COPY } from './gameCopy';
import { PlayingCard } from './PlayingCard';
import { HandGuide } from './HandGuide';

type Table = NonNullable<RoomView['table']>;
type TableProps = { room: RoomView; table: Table };
export type RoomPlay = (command: RoomCommand) => void;

function seatName(room: RoomView, seat: number) {
  return seat === room.seat ? '你' : room.players[seat];
}

function moveLine(room: RoomView, move: RoomMove) {
  return `${seatName(room, move.seat)}${move.timedOut ? '超时，' : ' · '}${ACTION_NAMES[move.kind]}${move.cost ? ` ${move.cost} 道` : ''}`;
}

function cardText(card: Card) {
  return `${card.name} ${digitsOf(card).join('·')}`;
}

function RoomClock({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="room-clock" title="超时自动过牌或弃牌">{Math.max(0, Math.ceil((deadline - now) / 1000))} 秒</span>;
}

function Opponents({ room, table }: TableProps) {
  return <ul className="room-opponents" aria-label="其他座位">
    {room.players.map((name, index) => {
      if (index === room.seat) return null;
      const [open, hole] = table.cards[index];
      const isTurn = table.turn === index;
      return <li key={index} data-turn={isTurn}>
        <div className="room-opponent-name"><strong>{name}</strong><span>{table.banks[index]} 道</span></div>
        <p className="room-other-card"><span>明牌</span><b>{cardText(open)}</b></p>
        <p className="room-other-card"><span>暗牌</span>{hole ? <b>{cardText(hole)}</b> : <span>盖着</span>}</p>
        <p className="room-seat-status">{table.folded[index] ? '已弃牌' : isTurn ? '正在行动'
          : table.phase === 'playing' ? `本手投入 ${table.invested[index]} 道` : '本手已结算'}</p>
      </li>;
    })}
  </ul>;
}

function resultText(room: RoomView, entry: RoomHandRecord) {
  if (entry.winners.length > 1) return `${entry.winners.map(seat => seatName(room, seat)).join('、')}平分底池`;
  return `${seatName(room, entry.winners[0])}拿下底池`;
}

export function RoomTable({ room, table, deadline, busy, play }: TableProps & {
  deadline: number | null; busy: boolean; play: RoomPlay;
}) {
  const mine = table.cards[room.seat];
  const myTurn = table.turn === room.seat;
  const settled = table.phase === 'settled' ? table.history.at(-1) : undefined;
  const hand = table.hand + 1;
  const firstHand = table.history[0] ?? table;
  const guessKey = ['shuowangyue.guide', room.code, firstHand.publicCard.id, ...firstHand.cards.map(pair => pair[0].id)].join('.');
  const [judgment, setJudgment] = useState<Rule | null>(() => {
    try { return RULES.find(rule => rule === localStorage.getItem(guessKey)) ?? null; }
    catch { return null; }
  });

  function chooseRule(rule: Rule) {
    setJudgment(rule);
    try { localStorage.setItem(guessKey, rule); }
    catch { /* The choice remains available while this page is open. */ }
  }

  return <section className="room-table" aria-label="联机牌桌">
    <div className="table-heading">
      <div className="table-round">
        <h1>第 <strong>{hand}</strong> / {ROOM_HANDS} 手</h1>
        <ol className="hand-progress" aria-label="八手进度">
          {Array.from({ length: ROOM_HANDS }, (_, index) => <li key={index}
            aria-current={index === table.hand ? 'step' : undefined} data-complete={index < table.history.length}>
            <span className="sr-only">第{index + 1}手</span>
          </li>)}
        </ol>
      </div>
      <span>{room.size === 2 ? '双人桌' : '四人桌'} · 下注单位 {table.unit} 道</span>
    </div>
    <div className="felt room-felt">
      <Opponents room={room} table={table} />
      <div className="room-pot"><span>底池</span><strong>{settled ? settled.pot : table.pot}</strong><span>道</span></div>
      <div className="room-cards">
        <PlayingCard value={mine[0]} label="你的明牌" />
        <PlayingCard value={table.publicCard} label="公共牌" />
        <PlayingCard value={mine[1]} label="你的暗牌" />
      </div>
      <div className="room-balance"><strong>{room.players[room.seat]} · 你</strong><span><b>{table.banks[room.seat]}</b> 道</span>
        {table.phase === 'playing' && <span className="muted">本手投入 {table.invested[room.seat]} 道</span>}
      </div>
    </div>
    <div className={`action-area room-actions${myTurn ? ' action-ready' : ''}`}>
      <div className="action-heading">
        <div className="turn-status" role="status">
          <strong>{settled ? resultText(room, settled) : myTurn ? '轮到你了' : `等待${room.players[table.turn!]}行动`}</strong>
          {table.lastMove && <span>{moveLine(room, table.lastMove)}</span>}
        </div>
        {deadline !== null && <RoomClock deadline={deadline} />}
      </div>
      {settled ? <>
        <p className="room-awards">{settled.winners.map(seat => `${seatName(room, seat)} +${settled.awards[seat]} 道`).join(' · ')}</p>
        <button className="primary" disabled={busy} onClick={() => play({ kind: 'next', revision: room.revision })}>
          {hand === ROOM_HANDS ? '揭晓法则与复盘' : '下一手'}
        </button>
      </> : myTurn && <>
        <div className="action-buttons">
          {table.actions.map(action => <button key={action.kind} disabled={busy}
            className={action.kind === 'check' || action.kind === 'fold' ? 'secondary' : 'primary'}
            onClick={() => play({ kind: 'move', move: action.kind, revision: room.revision })}>
            {ACTION_NAMES[action.kind]}{action.cost ? ` · ${action.kind === 'call' ? '补' : ''}${action.cost}道` : ''}
          </button>)}
        </div>
        {table.canSwap ? <div className="room-swap">
          <button className="challenge-button" disabled={busy} onClick={() => play({ kind: 'swap', revision: room.revision })}>秘密换暗牌 · 1次</button>
          <span className="muted">从本手未发牌里换一张。</span>
        </div> : table.swapUsed && <p className="muted">本场换牌机会已用。</p>}
      </>}
    </div>
    {table.phase === 'playing' && !table.folded[room.seat] && <HandGuide
      publicCard={table.publicCard} mine={[mine[0], mine[1]!]}
      opponents={table.cards.flatMap(([upcard], seat) => seat === room.seat ? [] : [{ upcard, active: !table.folded[seat] }])}
      discarded={table.discarded} rule={judgment} onRuleChange={chooseRule} pot={table.pot}
      callCost={table.actions.find(action => action.kind === 'call')?.cost ?? 0}
      canAct={myTurn} canSwap={table.canSwap} />}
  </section>;
}

export function RoomRules() {
  return <div className="rulebook">
    <h2>联机规则</h2>
    <p>八手共用一套隐藏法则。每人 {ROOM_BANK} 道，每手先付 1 道底注，轮流担任先手。</p>
    <p>前四手每次开注或加注 1 道，后四手 2 道，每手最多加注一次。仍在牌局中的玩家响应完毕后摊牌，弃牌的暗牌保持盖着。</p>
    <p>第 5 手起，每人可在自己首次行动时秘密换一次暗牌。每次行动限时 60 秒，超时自动过牌或弃牌。</p>
    <p>并列平分底池，余下的整道从本手先手起顺序发给并列赢家。八手后筹码最多者获胜。</p>
    <details><summary>查看三套比较法则</summary>
      {RULES.map(rule => <section key={rule}><h3>{RULE_NAMES[rule]}</h3><p>{RULE_COPY[rule]}</p></section>)}
    </details>
  </div>;
}

function publicEvidence(table: Table) {
  const opening = compatibleRules(table.clue);
  return RULES.map(rule => {
    if (!opening.includes(rule)) return { rule, evidence: '开局判例排除' };
    for (const entry of table.history) {
      if (entry.reason !== 'showdown') continue;
      const cards = entry.cards.flatMap(([open, hole], seat) => hole ? [{ seat, cards: [open, hole] as [Card, Card] }] : []);
      const predicted = roomWinners(rule, entry.publicCard, cards);
      if (predicted.length !== entry.winners.length || predicted.some(seat => !entry.winners.includes(seat))) {
        return { rule, evidence: `第${entry.hand + 1}手摊牌排除` };
      }
    }
    return { rule, evidence: '与公开证据相符' };
  });
}

export function RoomEvidence({ table }: { table: Table }) {
  return <div className="clue-panel">
    <h2>开局判例</h2>
    <p className="muted">用甲、乙的胜负缩小范围，再观察实际摊牌。</p>
    <OpeningExample clue={table.clue} />
    <details className="room-clue-detail">
      <summary>对照公开证据</summary>
      <RuleComparison clue={table.clue} seats={['甲', '乙']} />
      {table.history.some(entry => entry.reason === 'showdown') && <dl className="room-evidence-list">
        {publicEvidence(table).map(({ rule, evidence }) => <div key={rule}><dt>{RULE_NAMES[rule]}</dt><dd>{evidence}</dd></div>)}
      </dl>}
    </details>
  </div>;
}

export function RoomHistory({ room, table }: TableProps) {
  return <div className="history room-history">
    <h2>牌局记录</h2>
    {!table.history.length && <p className="muted">第一手结束后可以回看。</p>}
    {[...table.history].reverse().map(entry => <details key={entry.hand}>
      <summary><span>第{entry.hand + 1}手</span><strong>{resultText(room, entry)}</strong><span>{entry.pot} 道</span></summary>
      <div className="history-body">
        <p>公共牌 <b>{cardText(entry.publicCard)}</b></p>
        {entry.cards.map(([open, hole], seat) => <p key={seat}>{seatName(room, seat)} <b>{cardText(open)}</b> / {hole ? cardText(hole) : '暗牌盖着'}</p>)}
        <ul className="moves">{entry.moves.map((move, index) => <li key={index}>{moveLine(room, move)}</li>)}</ul>
        <p className="muted">{entry.reason === 'fold' ? '弃牌收池' : '摊牌'} · {entry.winners.map(seat => `${seatName(room, seat)} +${entry.awards[seat]}道`).join(' · ')}</p>
      </div>
    </details>)}
  </div>;
}

export function RoomFinal({ room, table, busy, play }: TableProps & { busy: boolean; play: RoomPlay }) {
  const top = Math.max(...table.banks);
  const isWinner = table.banks[room.seat] === top;
  const tied = table.banks.filter(chips => chips === top).length > 1;
  const ranked = table.banks.map((chips, seat) => ({ chips, seat })).sort((a, b) => b.chips - a.chips);
  return <section className="final-panel room-final">
    <span className="result-seal" data-result={isWinner ? 'win' : 'loss'}>{isWinner ? tied ? '并' : '胜' : '终'}</span>
    <h1>{isWinner ? tied ? '并列第一' : '你赢了' : '八手已结束'}</h1>
    <ol className="room-ranking" aria-label="最终筹码">
      {ranked.map(({ chips, seat }) => <li key={seat}><span>{room.players[seat]}{seat === room.seat && ' · 你'}</span><b>{chips} 道</b></li>)}
    </ol>
    {table.rule && <div className="rule-reveal"><p>本场法则</p><h2>{RULE_NAMES[table.rule]}</h2><p>{RULE_COPY[table.rule]}</p></div>}
    {room.seat === 0
      ? <button className="primary" disabled={busy} onClick={() => play({ kind: 'rematch', revision: room.revision })}>再来一场</button>
      : <p className="muted">房主可以为这桌玩家开启下一场。</p>}
  </section>;
}
