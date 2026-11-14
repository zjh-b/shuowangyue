import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH, ROOM_NAME_LENGTH, type RoomView } from '../game/roomProtocol';
import type { SeatCount } from '../game/roomTable';
import { RULE_NAMES } from '../game/rules';
import { MusicToggle } from './MusicToggle';
import { PlaytestFeedback } from './PlaytestFeedback';
import { inviteCode, roomAddress, savedTicket, soloAddress } from './roomClient';
import { RoomEvidence, RoomFinal, RoomHistory, RoomRules, RoomTable, type RoomPlay } from './RoomTable';
import { useOnlineRoom } from './useOnlineRoom';

type Online = ReturnType<typeof useOnlineRoom>;
type RoomTab = 'clue' | 'rules' | 'history';
const tabs: Record<RoomTab, string> = { clue: '线索', rules: '规则', history: '记录' };

function EntryForm({ online }: { online: Online }) {
  const [mode, setMode] = useState<'create' | 'join'>(inviteCode ? 'join' : 'create');
  const [size, setSize] = useState<SeatCount>(2);
  const [name, setName] = useState('');
  const [code, setCode] = useState(inviteCode);
  const [validation, setValidation] = useState('');
  const recent = savedTicket();
  const serviceReady = online.service === 'ready';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setValidation('请输入你在牌桌上的称呼。'); return; }
    if (mode === 'join' && !isRoomCode(code)) { setValidation('请输入邀请链接里的 8 位房间码。'); return; }
    setValidation('');
    if (mode === 'create') void online.create(size, name);
    else void online.join(code, name);
  }

  return <section className="room-entry">
    <h1>联机对局</h1>
    <p className="room-intro-copy">建一张双人桌或四人桌，邀请朋友一起推理、下注。</p>
    <div className="room-entry-tabs" role="group" aria-label="入座方式">
      <button className="secondary" aria-pressed={mode === 'create'} disabled={online.busy}
        onClick={() => { setMode('create'); setValidation(''); }}>创建房间</button>
      <button className="secondary" aria-pressed={mode === 'join'} disabled={online.busy}
        onClick={() => { setMode('join'); setValidation(''); }}>加入房间</button>
    </div>
    <form className="room-form" onSubmit={submit}>
      {mode === 'create' ? <fieldset className="room-size">
        <legend>座位数</legend>
        <div>{([2, 4] as const).map(count => <label key={count}>
          <input type="radio" name="size" value={count} checked={size === count} disabled={online.busy}
            onChange={() => setSize(count)} />{count === 2 ? '双人桌' : '四人桌'}
        </label>)}</div>
      </fieldset> : <label htmlFor="room-code-input">房间码
        <input id="room-code-input" value={code} onChange={event => setCode(normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_LENGTH))}
          placeholder="输入 8 位房间码" required autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={online.busy} />
      </label>}
      <label htmlFor="room-name">称呼
        <input id="room-name" value={name} onChange={event => setName(event.target.value)} placeholder="朋友能认出你的称呼"
          required autoComplete="off" maxLength={ROOM_NAME_LENGTH * 2} disabled={online.busy} />
      </label>
      <button className="primary" type="submit" disabled={online.busy || !serviceReady}>
        {online.busy ? '正在入座…' : mode === 'create' ? '开一张桌' : '加入牌桌'}
      </button>
    </form>
    {online.service !== 'ready' && <div className="room-notice">
      <p role="status">{online.service === 'checking' ? '正在连接联机服务…' : '联机服务暂时不可用。'}</p>
      {online.service === 'unavailable' && <button className="text-button" onClick={online.retry}>重新连接</button>}
    </div>}
    {(validation || online.error) && <p className="room-error" role="alert">{validation || online.error}</p>}
    {recent && <button className="text-button room-resume" disabled={online.busy} onClick={() => online.resume(recent)}>回到上次的房间</button>}
  </section>;
}

function WaitingRoom({ room, busy, play }: { room: RoomView; busy: boolean; play: RoomPlay }) {
  const host = room.seat === 0;
  const full = room.players.length === room.size;
  const link = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState('');
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(roomAddress(room.code));
      setCopied('邀请链接已复制。');
    } catch {
      link.current?.focus();
      link.current?.select();
      setCopied('链接已选中，可以手动复制。');
    }
  }

  return <section className="room-entry room-lobby" aria-labelledby="room-lobby-title">
    <div className="room-lobby-heading">
      <h1 id="room-lobby-title">{room.size === 2 ? '双人桌' : '四人桌'}</h1>
      <span>{room.players.length} / {room.size} 已入座</span>
    </div>
    <p className="room-lobby-code">房间码 <strong>{room.code}</strong></p>
    <div className="room-invite">
      <label htmlFor="room-invite-link">邀请链接</label>
      <div><input ref={link} id="room-invite-link" value={roomAddress(room.code)} readOnly onFocus={event => event.target.select()} />
        <button className="secondary" onClick={() => void copyInvite()}>复制邀请链接</button></div>
      {copied && <p role="status">{copied}</p>}
    </div>
    <ol className="room-seats" aria-label="已入座玩家">
      {Array.from({ length: room.size }, (_, index) => <li key={index} data-filled={Boolean(room.players[index])}>
        <span>{index + 1} 席</span><strong>{room.players[index] ?? '等候入座'}</strong>
        <span>{index === 0 ? '房主' : ''}{index === room.seat ? (index === 0 ? ' · 你' : '你') : ''}</span>
      </li>)}
    </ol>
    <div className="room-lobby-actions">
      {host ? <button className="primary" disabled={!full || busy} onClick={() => play({ kind: 'start', revision: room.revision })}>开始对局</button>
        : <p role="status">{full ? '等房主开始对局。' : '等其他玩家入座。'}</p>}
      <button className="text-button" disabled={busy} onClick={() => play({ kind: 'leave', revision: room.revision })}>
        {host ? '解散房间' : '离开房间'}
      </button>
    </div>
  </section>;
}

export function OnlineRooms() {
  const online = useOnlineRoom();
  const { room, busy, deadline } = online;
  const table = room?.table;
  const [tab, setTab] = useState<RoomTab>('clue');
  const [feedback, setFeedback] = useState<Record<string, string | number> | null>(null);
  const finished = table?.phase === 'finished';
  const waiting = online.ticket && !room;
  const myTurn = table?.phase === 'playing' && table.turn === room?.seat;
  useEffect(() => {
    document.title = myTurn ? '轮到你了 · 朔望月' : '朔望月 · 八手之间';
    return () => { document.title = '朔望月 · 八手之间'; };
  }, [myTurn]);
  const openFeedback = () => setFeedback({
    '游戏模式': room ? `${room.size} 人联机` : '联机大厅',
    '对局进度': table ? finished ? '八手已完成' : `第${table.hand + 1}手` : '尚未开局',
    ...(table?.rule && { '本场法则': RULE_NAMES[table.rule] }),
  });
  const controlsDisabled = busy || online.reconnecting;

  return <div className="app-shell room-shell">
    <header className="site-header">
      <div className="wordmark">朔望月</div>
      <div className="header-right">
        <span className="build-label">试玩版 v{__GAME_VERSION__}</span>
        <MusicToggle playerTurn={myTurn} />
        <button className="text-button" onClick={openFeedback}>反馈</button>
        <a className="text-button" href={soloAddress()}>单人牌局</a>
      </div>
    </header>
    <main className="layout room-layout">
      <div className="main-column">
        {table && room ? <>
          {finished ? <RoomFinal room={room} table={table} busy={controlsDisabled} play={online.play} />
            : <RoomTable room={room} table={table} deadline={deadline} busy={controlsDisabled} play={online.play} />}
          <div className="room-table-links">
            <span className="muted">房间 {room.code}</span>
            <a className="text-button" href={roomAddress()}>返回联机大厅</a>
          </div>
        </> : room ? <WaitingRoom room={room} busy={controlsDisabled} play={online.play} />
          : waiting ? <section className="room-entry">
            <h1>返回房间</h1>
            <p role="status">{online.reconnecting ? '连接中断，正在重试…' : '正在恢复你的座位…'}</p>
            <a className="text-button" href={roomAddress()}>返回联机大厅</a>
          </section> : <EntryForm online={online} />}
        {room && online.reconnecting && <p role="status" className="room-notice">连接中断，正在恢复牌桌…</p>}
        {room && online.error && <p role="alert" className="room-error">{online.error}</p>}
      </div>
      <aside className="sidebar" aria-label="联机辅助">
        {room && table && <nav className="side-tabs room-side-tabs" aria-label="联机牌局辅助">
          {(Object.keys(tabs) as RoomTab[]).map(key => <button key={key} aria-pressed={tab === key}
            onClick={() => setTab(key)}>{tabs[key]}{key === 'history' && table.history.length ? ` ${table.history.length}` : ''}</button>)}
        </nav>}
        <div className="side-content">
          {room && table && tab === 'clue' ? <RoomEvidence table={table} />
            : room && table && tab === 'history' ? <RoomHistory room={room} table={table} />
              : <RoomRules />}
        </div>
      </aside>
    </main>
    <PlaytestFeedback summary={feedback} onClose={() => setFeedback(null)} />
  </div>;
}
