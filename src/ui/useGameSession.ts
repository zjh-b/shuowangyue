import { useEffect, useState } from 'react';
import { dealerAction } from '../game/dealer';
import { recordJudgment } from '../game/judgments';
import { token } from '../game/match';
import { RULES, type Rule } from '../game/rules';
import { applySessionEvent, createSession, encodeSession, NOTE_LIMIT, restoreSession, type SessionEvent } from '../game/session';

function testOptions() {
  if (!import.meta.env.DEV) return {};
  const params = new URLSearchParams(location.search);
  const seedValue = params.get('seed');
  const numericSeed = Number(seedValue);
  const seed = seedValue !== null && Number.isInteger(numericSeed) && numericSeed >= 0 && numericSeed <= 0xffffffff
    ? numericSeed : undefined;
  const rule = RULES.find(value => value === params.get('rule'));
  return { seed, rule };
}

const options = testOptions();
const storageKey = options.seed === undefined && options.rule === undefined
  ? 'shuowangyue.match' : `shuowangyue.dev.${options.seed ?? 'random'}.${options.rule ?? 'random'}`;
const freshSession = () => createSession(options.seed ?? crypto.getRandomValues(new Uint32Array(1))[0], options.rule);

function loadSession() {
  try {
    return restoreSession(localStorage.getItem(storageKey)) ?? freshSession();
  } catch {
    return freshSession();
  }
}

export function useGameSession() {
  const [session, setSession] = useState(loadSession);
  const [canSave, setCanSave] = useState(true);
  const { match } = session;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, encodeSession(session));
    } catch {
      setCanSave(false);
    }
  }, [session]);

  useEffect(() => {
    if (match.phase !== 'playing' || match.turn !== 1) return;
    const actionToken = token(match);
    const timer = window.setTimeout(() => {
      const kind = dealerAction(match);
      setSession(previous => token(previous.match) === actionToken
        ? applySessionEvent(previous, { type: 'move', seat: 1, kind, challenge: false }) : previous);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [match]);

  function dispatch(event: SessionEvent) {
    const actionToken = token(match);
    setSession(previous => {
      const isCurrent = event.type === 'hint'
        ? previous.match.seed === match.seed : token(previous.match) === actionToken;
      return isCurrent ? applySessionEvent(previous, event) : previous;
    });
  }

  return {
    session,
    canSave,
    dispatch,
    restart: () => setSession(freshSession()),
    saveJudgment: (rule: Rule) => setSession(previous => recordJudgment(previous, rule)),
    toggleGuess: (rule: Rule) => setSession(previous => ({ ...previous,
      guesses: previous.guesses.includes(rule) ? previous.guesses.filter(value => value !== rule) : [...previous.guesses, rule],
    })),
    setNote: (note: string) => setSession(previous => ({ ...previous, note: note.slice(0, NOTE_LIMIT) })),
  };
}
