import { describe, expect, it } from 'vitest';
import { createSession, applySessionEvent, encodeSession, restoreSession } from '../src/game/session';
import { playerView } from '../src/game/views';

describe('本地续局', () => {
  it('提示每场三次，已发出的判例可以在续局后复看', () => {
    const initial = createSession(28, 'large');
    let session = initial;
    for (let step = 0; step < 3; step++) session = applySessionEvent(session, { type: 'hint', step });
    expect(session.hints.used).toBe(3);
    expect(session.hints.evidence).toBeDefined();
    expect(session.match).toBe(initial.match);
    expect(applySessionEvent(session, { type: 'hint', step: 3 })).toBe(session);
    expect(restoreSession(encodeSession(session))).toEqual(session);
  });

  it('庄家等待、挑战结算、笔记与验牌均可重放恢复', () => {
    let session = createSession(28, 'large');
    session = applySessionEvent(session, { type: 'start' });
    session = applySessionEvent(session, { type: 'move', seat: 0, kind: 'bet', challenge: true });
    expect(session.match.phase).toBe('settled');
    session = applySessionEvent(session, { type: 'next' });
    expect(session.match.turn).toBe(1);
    expect(restoreSession(encodeSession(session))).toEqual(session);
    session = applySessionEvent(session, { type: 'move', seat: 1, kind: 'bet', challenge: false });
    session = applySessionEvent(session, { type: 'move', seat: 0, kind: 'fold', challenge: false });
    session = applySessionEvent(session, { type: 'inspect' });
    session = { ...session, note: '复看第2手验牌', guesses: ['large', 'near'] };
    const restored = restoreSession(encodeSession(session));
    expect(restored).toEqual(session);
    expect(playerView(restored!.match).history[1].inspected).toBe(true);
  });

  it('非法动作、重复提示和无效存档不会影响本场', () => {
    const session = createSession(1);
    expect(applySessionEvent(session, { type: 'move', seat: 1, kind: 'bet', challenge: true })).toBe(session);
    expect(applySessionEvent(session, { type: 'hint', step: 2 })).toBe(session);
    const data = JSON.parse(encodeSession(session));
    expect(restoreSession(JSON.stringify({ ...data, events: [{ type: 'next' }] }))).toBeNull();
    expect(restoreSession(JSON.stringify({ ...data, version: -1 }))).toBeNull();
    expect(restoreSession('截断的存档')).toBeNull();
  });
});
