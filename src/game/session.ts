import { HINT_COUNT, evidenceForHint, type EvidenceHint } from './hints';
import { restoreJudgments, type Judgments } from './judgments';
import {
  applyAction, createMatch, inspectHand, nextHand, startMatch, swapHole, token,
  type ActionKind, type Match, type Seat,
} from './match';
import { RULES, type Rule } from './rules';
import { playerView } from './views';

type MoveEvent = { type: 'move'; seat: Seat; kind: ActionKind; challenge: boolean };
export type SessionEvent = MoveEvent
  | { type: 'start' | 'next' | 'inspect' | 'swap' }
  | { type: 'hint'; step: number };

export type Session = {
  match: Match;
  forcedRule?: Rule;
  events: SessionEvent[];
  hints: { used: number; evidence?: EvidenceHint };
  judgments: Judgments | null;
  guesses: Rule[];
  note: string;
};

const SAVE_VERSION = 1;
const ACTIONS: readonly ActionKind[] = ['check', 'bet', 'call', 'raise', 'fold'];
export const NOTE_LIMIT = 1500;

export function createSession(seed: number, forcedRule?: Rule): Session {
  return { match: createMatch(seed, forcedRule), forcedRule, events: [], hints: { used: 0 }, judgments: null, guesses: [], note: '' };
}

export function applySessionEvent(session: Session, event: SessionEvent): Session {
  const { match, hints } = session;
  if (event.type === 'hint') {
    if (match.phase === 'finished' || event.step !== hints.used || hints.used >= HINT_COUNT) return session;
    const used = hints.used + 1;
    const evidence = used === HINT_COUNT
      ? evidenceForHint(match.clue, match.rule, playerView(match).history)
      : undefined;
    return { ...session, hints: { used, ...(evidence ? { evidence } : {}) }, events: [...session.events, event] };
  }

  let updated = match;
  switch (event.type) {
    case 'start': updated = startMatch(match); break;
    case 'next': updated = nextHand(match); break;
    case 'inspect': updated = inspectHand(match); break;
    case 'swap': updated = swapHole(match); break;
    case 'move':
      if (event.seat === match.turn) updated = applyAction(match, { ...event, token: token(match) });
      break;
  }
  return updated === match ? session : { ...session, match: updated, events: [...session.events, event] };
}

export function encodeSession({ match, forcedRule, events, guesses, note, judgments }: Session): string {
  return JSON.stringify({ version: SAVE_VERSION, seed: match.seed, forcedRule, events, guesses, note, judgments });
}

function isRule(value: unknown): value is Rule {
  return RULES.some(rule => rule === value);
}
function isEvent(value: unknown): value is SessionEvent {
  if (value === null || typeof value !== 'object' || !('type' in value)) return false;
  if (value.type === 'start' || value.type === 'next' || value.type === 'inspect' || value.type === 'swap') return true;
  if (value.type === 'hint') return 'step' in value && Number.isInteger(value.step);
  return value.type === 'move'
    && 'seat' in value && (value.seat === 0 || value.seat === 1)
    && 'kind' in value && ACTIONS.some(kind => kind === value.kind)
    && 'challenge' in value && typeof value.challenge === 'boolean';
}

export function restoreSession(raw: string | null): Session | null {
  if (!raw || raw.length > 24_000) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION
      || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff
      || (data.forcedRule !== undefined && !isRule(data.forcedRule))
      || !Array.isArray(data.events) || data.events.length > 64 || !data.events.every(isEvent)
      || !Array.isArray(data.guesses) || data.guesses.length > RULES.length || !data.guesses.every(isRule)
      || typeof data.note !== 'string' || data.note.length > NOTE_LIMIT) return null;
    let session = createSession(data.seed, data.forcedRule);
    for (const event of data.events) {
      const next = applySessionEvent(session, event);
      if (next === session) return null;
      session = next;
    }
    return { ...session, guesses: [...new Set<Rule>(data.guesses)], note: data.note, judgments: restoreJudgments(data.judgments) };
  } catch {
    return null;
  }
}
