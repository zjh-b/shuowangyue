import { expect, it } from 'vitest';
import { CARDS, card } from '../src/game/cards';
import { handOutlook, callThreshold, swapOutlook, type HandKnowledge } from '../src/game/handOutlook';
import { compareHands, RULES } from '../src/game/rules';

const known: HandKnowledge = {
  publicCard: card('春节'),
  mine: [card('重阳'), card('七夕')],
  opponents: [{ upcard: card('端午'), active: true }],
};

it('三套法则仅按可见牌枚举，复制卡牌对象仍得到相同结果', () => {
  const unseen = CARDS.filter(item => !['春节', '重阳', '七夕', '端午'].includes(item.id));
  for (const rule of RULES) {
    const actual = handOutlook(rule, known);
    const outcomes = unseen.map(hole => compareHands(rule, known.publicCard, known.mine, [card('端午'), hole]).winner);
    expect(actual.cases).toBe(32);
    expect(actual.wins).toBe(outcomes.filter(result => result === 0).length);
    expect(actual.ties).toBe(outcomes.filter(result => result === null).length);
    expect(actual.losses).toBe(outcomes.filter(result => result === 1).length);
    expect(actual.equity).toBeCloseTo((actual.wins + actual.ties / 2) / actual.cases, 12);
    expect(actual.score.sum).toBe(34);
    expect(handOutlook(rule, structuredClone(known))).toEqual(actual);
  }
});

it('四人桌暗牌互不重复，共有 24360 种分配，平局按实际并列人数分池', () => {
  const information: HandKnowledge = {
    ...known,
    opponents: [...known.opponents, { upcard: card('立夏'), active: true }, { upcard: card('小暑'), active: true }],
  };
  const blocked = new Set([information.publicCard, ...information.mine, ...information.opponents.map(player => player.upcard)].map(item => item.id));
  const possible = CARDS.filter(item => !blocked.has(item.id));
  const actual = handOutlook('large', information);
  const comparisons = information.opponents.map(player => possible.map(hole => compareHands('large', information.publicCard,
    information.mine, [player.upcard, hole]).winner));
  let wins = 0, ties = 0, losses = 0, share = 0;
  for (let a = 0; a < possible.length; a++) {
    for (let b = 0; b < possible.length; b++) {
      if (a === b) continue;
      for (let c = 0; c < possible.length; c++) {
        if (c === a || c === b) continue;
        const outcomes = [comparisons[0][a], comparisons[1][b], comparisons[2][c]];
        if (outcomes.includes(1)) losses++;
        else {
          const equal = outcomes.filter(result => result === null).length;
          if (equal) ties++;
          else wins++;
          share += 1 / (equal + 1);
        }
      }
    }
  }
  expect(actual).toMatchObject({ cases: 24360, wins, ties, losses });
  expect(actual.equity).toBeCloseTo(share / 24360, 10);
});

it('弃牌者的明牌仍占牌，自己的已知弃牌也从可能暗牌中移除', () => {
  const information: HandKnowledge = {
    ...known,
    opponents: [...known.opponents, { upcard: card('立夏'), active: false }, { upcard: card('小暑'), active: false }],
    discarded: card('冬至'),
  };
  expect(handOutlook('near', information).cases).toBe(29);
  expect(swapOutlook('near', information).cases).toBe(29);
  expect(handOutlook('near', { ...information, opponents: information.opponents.map(player => ({ ...player, active: false })) }))
    .toMatchObject({ wins: 1, cases: 1, equity: 1 });
});

it('换牌提示比较候选新牌和当前牌力，提升、持平、下降合计覆盖可能牌', () => {
  for (const rule of RULES) {
    const blocked = new Set([known.publicCard, ...known.mine, ...known.opponents.map(player => player.upcard)].map(item => item.id));
    const possible = CARDS.filter(item => !blocked.has(item.id));
    const outcomes = possible.map(hole => compareHands(rule, known.publicCard, [known.mine[0], hole], known.mine).winner);
    const result = swapOutlook(rule, known);
    expect(result).toEqual({
      cases: 32,
      improves: outcomes.filter(value => value === 0).length,
      same: outcomes.filter(value => value === null).length,
      worsens: outcomes.filter(value => value === 1).length,
    });
  }
});

it('跟注门槛按新增支出计算，已投入的筹码包含在底池中', () => {
  expect(callThreshold(3, 1)).toBe(0.25);
  expect(callThreshold(7, 2)).toBeCloseTo(2 / 9);
  expect(callThreshold(2, 0)).toBeNull();
});
