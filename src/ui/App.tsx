import { useRef, useState } from 'react';
import { card } from '../game/cards';
import { HINT_COUNT } from '../game/hints';
import { RULE_NAMES, RULES } from '../game/rules';
import { NOTE_LIMIT } from '../game/session';
import { playerView } from '../game/views';
import { CluePanel } from './CluePanel';
import { MatchTable } from './MatchTable';
import { MusicToggle } from './MusicToggle';
import { Onboarding } from './Onboarding';
import { PlayingCard } from './PlayingCard';
import { JudgmentForm, PlaytestReview } from './PlaytestReview';
import { History, RuleBook } from './Records';
import { ShareGame } from './ShareGame';
import { RULE_COPY } from './gameCopy';
import { useGameSession } from './useGameSession';

const TABS = { clue: '线索与提示', rules: '规则册', history: '记录', notes: '笔记' } as const;
type Tab = keyof typeof TABS;
const tabNames = Object.keys(TABS) as Tab[];
const welcomeCard = card('七夕');

export function App() {
  const { session, canSave, dispatch, restart, saveJudgment, toggleGuess, setNote } = useGameSession();
  const { match, hints, guesses, note } = session;
  const intro = match.phase === 'intro';
  const finished = match.phase === 'finished';
  const [tab, setTab] = useState<Tab>(finished ? 'history' : 'clue');
  const [guide, setGuide] = useState<'enter' | 'review' | null>(null);
  const guideTrigger = useRef<HTMLElement | null>(null);
  const view = playerView(match);
  const net = match.banks[0] - 32;
  const last = match.history.at(-1);
  const showdown = match.phase === 'settled' && last?.reason === 'showdown'
    && (last.challenged || last.swap || match.hand === 7) ? last : undefined;

  function restartMatch() {
    if (!intro && !finished && !window.confirm('重新开局会结束当前牌局，确定继续？')) return;
    restart();
    setTab('clue');
  }

  function openClues(target = 'hint-heading') {
    setTab('clue');
    requestAnimationFrame(() => {
      const heading = document.getElementById(target);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: matchMedia('(max-width: 820px)').matches ? 'start' : 'nearest' });
    });
  }

  function returnToActions() {
    const actions = document.getElementById('table-actions');
    actions?.focus({ preventScroll: true });
    actions?.scrollIntoView({ block: 'center' });
  }

  function advance() {
    dispatch({ type: 'next' });
    if (match.hand === 7) setTab('history');
  }

  function openEvidence(hand: number) {
    setTab('history');
    requestAnimationFrame(() => {
      const entry = document.querySelector<HTMLDetailsElement>(`#history-hand-${hand}`);
      if (!entry) return;
      entry.open = true;
      const summary = entry.querySelector('summary');
      summary?.focus({ preventScroll: true });
      summary?.scrollIntoView({ block: 'nearest' });
    });
  }

  function openGuide(mode: 'enter' | 'review', trigger: HTMLButtonElement) {
    guideTrigger.current = trigger;
    setGuide(mode);
  }

  function closeGuide() {
    setGuide(null);
    requestAnimationFrame(() => guideTrigger.current?.focus({ preventScroll: true }));
  }

  function enterMatch() {
    setGuide(null);
    dispatch({ type: 'start' });
    requestAnimationFrame(() => {
      const heading = document.getElementById('match-heading');
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'nearest' });
    });
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="wordmark">朔望月</div>
      <div className="header-right">
        <span className="build-label">试玩版 v{__GAME_VERSION__}</span>
        <MusicToggle showdown={showdown} />
        <ShareGame />
        {!intro && !finished && <button className="text-button" onClick={restartMatch}>重新开局</button>}
      </div>
    </header>
    <main className={`layout${intro ? ' intro-layout' : ''}`}>
      <div className="main-column">
        {intro ? <section className="intro">
          <div className="intro-cards" aria-hidden="true">
            <PlayingCard value={null} />
            <PlayingCard value={welcomeCard} />
            <PlayingCard value={null} />
          </div>
          <div className="intro-body">
            <h1>八手之间，<br />看透牌局。</h1>
            <p className="intro-copy">从节气与节日的牌面推断本场法则，再和能透视底牌的地猴过招。</p>
            <button className="primary start-button" onClick={event => openGuide('enter', event.currentTarget)}>入局 <span>32道起手</span></button>
            <button className="text-button mobile-clue" onClick={() => openClues('clue-heading')}>先看开局线索</button>
          </div>
        </section> : finished ? <section className="final-panel">
          <span className="result-seal" data-result={net > 0 ? 'win' : net === 0 ? 'tie' : 'loss'}>{net > 0 ? '胜' : net === 0 ? '和' : '负'}</span>
          <h1>{net > 0 ? '这一次，你看透了牌局。' : net === 0 ? '月有盈亏，筹码未改。' : '带着答案，再入一局。'}</h1>
          <p className="final-balance">你带走 <strong>{match.banks[0]}</strong> 道 <span>净收益 {net > 0 ? '+' : ''}{net}</span></p>
          <div className="rule-reveal">
            <p>本场法则</p><h2>{RULE_NAMES[match.rule]}</h2><p>{RULE_COPY[match.rule]}</p>
          </div>
          <PlaytestReview session={session} onEvidence={openEvidence} />
          <button className="primary" onClick={restartMatch}>再来一场</button>
        </section> : <MatchTable match={match} view={view} hintsLeft={HINT_COUNT - hints.used}
          onClue={() => openClues()} onAdvance={advance} dispatch={dispatch} />}
        {!canSave && <p className="save-status">此浏览器无法保存进度，关闭或刷新页面前请先完成本场。</p>}
      </div>

      <aside className="sidebar" id="table-evidence" aria-label="线索与记录">
        <nav className="side-tabs" aria-label="牌局辅助">
          {tabNames.map(name => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>
            {TABS[name]}{name === 'history' && view.history.length > 0 ? ` ${view.history.length}` : ''}
          </button>)}
        </nav>
        <div className="side-content" key={tab}>
          {tab === 'clue' && <CluePanel clue={match.clue} used={hints.used} evidence={hints.evidence} finished={finished}
            onHint={() => dispatch({ type: 'hint', step: hints.used })}
            onReturn={!intro && !finished ? returnToActions : undefined} />}
          {tab === 'rules' && <RuleBook onGuide={trigger => openGuide('review', trigger)} />}
          {tab === 'history' && <History entries={view.history} rule={finished ? match.rule : undefined} />}
          {tab === 'notes' && <div className="notes">
            <h2>留下你的判断</h2>
            <JudgmentForm key={match.seed} judgments={session.judgments} finished={finished} onSave={saveJudgment} />
            <p className="muted">勾选仍可能成立的法则，记下你看到的证据。</p>
            <div className="guess-list">{RULES.map(rule => <label key={rule}>
              <input type="checkbox" checked={guesses.includes(rule)} onChange={() => toggleGuess(rule)} />{RULE_NAMES[rule]}
            </label>)}</div>
            <label className="note-label" htmlFor="note">哪一手支持或推翻了你的猜测？</label>
            <textarea id="note" value={note} maxLength={NOTE_LIMIT} onChange={e => setNote(e.target.value)}
              placeholder="例如：第2手我的总点数更高，却输了……" />
            {canSave && <p className="muted">笔记和牌局会自动保存在当前浏览器。</p>}
          </div>}
        </div>
      </aside>
    </main>
    {guide && <Onboarding entering={guide === 'enter'} onClose={closeGuide} onEnter={enterMatch} />}
  </div>;
}
