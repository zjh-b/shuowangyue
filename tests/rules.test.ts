import { describe, expect, it } from 'vitest';
import { CARDS, card, digitsOf } from '../src/game/cards';
import { compareHands, scoreCards } from '../src/game/rules';
import { CLUES, compatibleRules } from '../src/game/clues';

describe('公开牌表与判例', () => {
  it('36张独立牌，日期相同的小寒和腊八可以同时发出', () => {
    expect(new Set(CARDS.map(c => c.id)).size).toBe(36);
    expect(digitsOf(card('小寒'))).toEqual(digitsOf(card('腊八')));
    expect(digitsOf(card('除夕'))).toEqual([1, 2, 3, 0]);
  });
  it('同一桌实牌在三套规则下由甲、乙、甲获胜', () => {
    const a = [card('重阳'), card('除夕')], b = [card('中元'), card('腊八')];
    expect(compareHands('large', card('春节'), a, b)).toMatchObject({ winner: 0, criterion: '顺子长度' });
    expect(compareHands('repeat', card('春节'), a, b)).toMatchObject({ winner: 1, criterion: '重复次数' });
    expect(compareHands('near', card('春节'), a, b)).toMatchObject({ winner: 0, criterion: '顺子长度' });
  });
  it('每条开局线索恰好保留两个候选，每条规则有两个相容线索', () => {
    expect(CLUES.map(c => compatibleRules(c).length)).toEqual([2, 2, 2]);
    for (const r of ['large', 'repeat', 'near'] as const) {
      expect(CLUES.filter(c => compatibleRules(c).includes(r))).toHaveLength(2);
    }
  });
  it('0可组成四连，8、9、0不构成循环三连', () => {
    expect(scoreCards([card('除夕')]).straight).toBe(4);
    expect(scoreCards([{ id: 'test', name: '测试', month: 8, day: 90, kind: '节气' }]).straight).toBe(0);
  });
  it('重复次数相同时取较大的数字，完全相同的数字分布平局', () => {
    expect(scoreCards([card('七夕'), card('春节')]).repeatedDigit).toBe(7);
    expect(compareHands('repeat', card('春节'), [card('小寒')], [card('腊八')]).winner).toBeNull();
  });
});
