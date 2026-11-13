import { describe, expect, it } from 'vitest';
import { firstRuleEvidence } from '../src/game/hints';
import { recordJudgment, type Judgment } from '../src/game/judgments';
import { playtestRecord, playtestSummary } from '../src/game/playtest';
import { applySessionEvent, createSession, encodeSession, restoreSession } from '../src/game/session';
import { simulateMatch, STRATEGIES } from '../src/game/simulation';
import { playerView } from '../src/game/views';

describe('试玩复盘', () => {
  it('记录首个与最新判断，旧存档继续可读', () => {
    let session = createSession(28, 'large');
    session = recordJudgment(session, 'near');
    session = applySessionEvent(session, { type: 'start' });
    session = applySessionEvent(session, { type: 'move', seat: 0, kind: 'bet', challenge: true });
    session = applySessionEvent(session, { type: 'hint', step: 0 });
    session = recordJudgment(session, 'large');
    const first: Judgment = { rule: 'near', hand: 0, phase: 'intro', hintsUsed: 0 };
    const latest: Judgment = { rule: 'large', hand: 0, phase: 'settled', hintsUsed: 1 };
    expect(session.judgments).toEqual({ first, latest });
    expect(recordJudgment(session, 'large')).toBe(session);
    expect(restoreSession(encodeSession(session))).toEqual(session);
    const legacy = JSON.parse(encodeSession(session));
    delete legacy.judgments;
    expect(restoreSession(JSON.stringify(legacy))?.match).toEqual(session.match);
    expect(restoreSession(JSON.stringify(legacy))?.judgments).toBeNull();
  });

  it('仅通过公开摊牌或验牌定位最早能区分规则的一手', () => {
    for (let seed = 0; seed < 50; seed++) {
      let session = applySessionEvent(createSession(seed, 'large'), { type: 'start' });
      session = applySessionEvent(session, { type: 'move', seat: 0, kind: 'bet', challenge: false });
      session = applySessionEvent(session, { type: 'move', seat: 1, kind: 'fold', challenge: false });
      expect(firstRuleEvidence(session.match.clue, playerView(session.match).history)).toBeUndefined();
      session = applySessionEvent(session, { type: 'inspect' });
      const evidence = firstRuleEvidence(session.match.clue, playerView(session.match).history);
      if (evidence) {
        expect(evidence).toMatchObject({ source: 'inspection', hand: 0 });
        return;
      }
    }
    expect.fail('测试牌序应至少包含一次有区分度的验牌');
  });

  it('同一规则与牌序可复现四种策略的完整八手', () => {
    const matches = STRATEGIES.map(strategy => simulateMatch(28, 'large', strategy));
    for (const [index, match] of matches.entries()) {
      expect(match.phase).toBe('finished');
      expect(match.history).toHaveLength(8);
      expect(match.banks[0] + match.banks[1]).toBe(64);
      expect(match.deals).toEqual(matches[0].deals);
      expect(match).toEqual(simulateMatch(28, 'large', STRATEGIES[index]));
    }
    expect(matches[0].history.flatMap(entry => entry.moves)
      .filter(move => move.seat === 0).every(move => move.kind === 'check' || move.kind === 'fold')).toBe(true);
  });

  it('仅在终局导出，保留公开记录并省略私人笔记和未验暗牌', () => {
    const session = { ...createSession(28, 'large'), note: '私人内容' };
    expect(playtestRecord(session)).toBeNull();
    const match = simulateMatch(28, 'large', 'fold');
    const record = playtestRecord({ ...session, match });
    expect(record?.hands).toHaveLength(8);
    const folded = record?.hands.filter(hand => hand.reason === 'fold') ?? [];
    expect(folded.length).toBeGreaterThan(0);
    expect(folded.every(hand => hand.cards[1][1] === null)).toBe(true);
    expect(record).not.toHaveProperty('seed');
    expect(JSON.stringify(record)).not.toContain('私人内容');
  });

  it('反馈摘要可在牌局中查看，并只在终局包含本场法则和净收益', () => {
    let session = { ...createSession(28, 'large'), note: '私人内容' };
    session = applySessionEvent(session, { type: 'start' });
    session = applySessionEvent(session, { type: 'hint', step: 0 });
    session = recordJudgment(session, 'near');

    const summary = playtestSummary(session);
    expect(summary).toMatchObject({
      '对局进度': '第1手进行中',
      '已用提示': 1,
      '首次判断': '近数局 · 第1手行动时',
    });
    expect(summary).not.toHaveProperty('本场法则');
    expect(summary).not.toHaveProperty('终局净收益');
    expect(JSON.stringify(summary)).not.toContain('私人内容');
    expect(Object.values(summary).every(value => typeof value === 'string' || typeof value === 'number')).toBe(true);

    const match = simulateMatch(28, 'large', 'evidence');
    expect(playtestSummary({ ...session, match })).toMatchObject({
      '对局进度': '八手已完成',
      '本场法则': '大数局',
      '终局净收益': match.banks[0] - 32,
    });
  });
});
