import { describe, expect, it } from 'vitest';
import { applyAction, createMatch, currentHand, inspectHand, legalActions, nextHand, startMatch, token, type Match, type ActionKind } from '../src/game/match';
import { playerView } from '../src/game/views';
import { chooseDealerAction } from '../src/game/dealer';
import { makeRng } from '../src/game/cards';

const act = (s: Match, kind: ActionKind, challenge = false) => applyAction(s, { kind, challenge, token: token(s) });

describe('八手对局', () => {
  it('固定种子重现相同发牌，每手五张各不相同', () => {
    expect(createMatch(123)).toEqual(createMatch(123));
    for (const h of createMatch(123).deals) expect(new Set([h.publicCard, ...h.cards.flat()].map(c => c.id)).size).toBe(5);
  });
  it('重复提交旧回合操作不会扣款或再次派彩', () => {
    let s = startMatch(createMatch(1));
    const old = { kind: 'bet' as const, token: token(s) };
    s = applyAction(s, old);
    expect(applyAction(s, old)).toBe(s);
    s = act(s, 'call');
    expect(s.banks.reduce((a, b) => a + b) + s.pot).toBe(64);
    expect(act(s, 'call')).toBe(s);
  });
  it('挑战强制跟注，弃牌验牌不改筹码且只能用一次', () => {
    let s = startMatch(createMatch(2));
    s = act(s, 'bet', true);
    expect(s.phase).toBe('settled');
    expect(s.history[0].moves.at(-1)?.kind).toBe('call');
    expect(s.challengeUsed[0]).toBe(true);
    s = nextHand(s);
    s = act(s, 'bet'); // 庄家先手
    s = act(s, 'fold');
    const banks = [...s.banks];
    expect(playerView(s).cards[1][1]).toBeNull();
    s = inspectHand(s);
    expect(s.banks).toEqual(banks);
    expect(playerView(s).cards[1][1]).not.toBeNull();
    expect(inspectHand(s)).toBe(s);
  });
  it('第5手下注与挑战更新，第8手结算后才结束', () => {
    let s = startMatch(createMatch(5));
    s = act(s, 'bet', true);
    for (let hand = 1; hand < 4; hand++) {
      s = nextHand(s); s = act(act(s, 'check'), 'check');
    }
    s = nextHand(s);
    expect(s.hand).toBe(4);
    expect(legalActions(s).find(a => a.kind === 'bet')).toMatchObject({ cost: 2, challengeAllowed: true });
    while (s.phase !== 'finished') {
      if (s.phase === 'settled') s = nextHand(s);
      else s = act(s, 'check');
    }
    expect(s.history).toHaveLength(8);
    expect(s.banks[0] + s.banks[1]).toBe(64);
  });
  it('终局仍隐藏未经查验的弃牌底牌，已验牌与摊牌记录仍可复盘', () => {
    let s = startMatch(createMatch(19));
    s = inspectHand(act(act(s, 'bet'), 'fold'));
    s = nextHand(s);
    s = act(act(s, 'bet'), 'fold');
    while (s.hand < 7) s = act(act(nextHand(s), 'check'), 'check');
    s = nextHand(s);
    const { history } = playerView(s);
    expect(history[0].cards[1][1]).not.toBeNull();
    expect(history[1].cards[1][1]).toBeNull();
    expect(history[1].inspectionVerdict).toBeUndefined();
    expect(history[7].cards[1][1]).not.toBeNull();
  });
  it('随机合法路径始终守恒，能打满八手且余额非负', () => {
    for (let seed = 0; seed < 500; seed++) {
      let s = startMatch(createMatch(seed));
      const rng = makeRng(seed + 12);
      let iterations = 0;
      while (s.phase !== 'finished' && iterations++ < 60) {
        if (s.phase === 'settled') s = nextHand(s);
        else {
          const options = legalActions(s);
          const choice = options[Math.floor(rng() * options.length)];
          expect(choice).toBeDefined();
          s = act(s, choice.kind, choice.challengeAllowed && rng() < 0.2);
        }
        expect(s.banks[0] + s.banks[1] + s.pot).toBe(64);
        expect(Math.min(...s.banks)).toBeGreaterThanOrEqual(0);
      }
      expect(s.phase).toBe('finished');
      expect(s.history).toHaveLength(8);
    }
  });
  it('庄家只接收本手和公开信息，合法决策可重复', () => {
    const s = startMatch(createMatch(6));
    const view = { ...currentHand(s), rule: s.rule, publicMoves: s.moves };
    const allowed = legalActions(s);
    const decision = chooseDealerAction(view, allowed, makeRng(9));
    expect(allowed.map(a => a.kind)).toContain(decision);
    expect(chooseDealerAction(view, allowed, makeRng(9))).toBe(decision);
  });
});
