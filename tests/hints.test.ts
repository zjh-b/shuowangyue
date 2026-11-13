import { describe, expect, it } from 'vitest';
import { CLUES, compatibleRules } from '../src/game/clues';
import { createMatch, startMatch, applyAction, nextHand, inspectHand, token } from '../src/game/match';
import { playerView } from '../src/game/views';
import { RULES } from '../src/game/rules';
import { candidateResults, evidenceForHint } from '../src/game/hints';

describe('公开线索提示', () => {
  it('开局对照准确排除一套规则，保留两套', () => {
    for (const clue of CLUES) {
      const candidates = candidateResults(clue);
      expect(candidates.filter(item => item.winner === clue.winner).map(item => item.rule))
        .toEqual(compatibleRules(clue));
      expect(candidates.filter(item => item.winner !== clue.winner)).toHaveLength(1);
    }
  });

  it('每种开局判例与适用规则都有能区分剩余候选的额外判例', () => {
    for (const opening of CLUES) {
      for (const rule of compatibleRules(opening)) {
        const hint = evidenceForHint(opening, rule, []);
        expect(hint.source).toBe('example');
        expect(candidateResults(hint.clue).filter(item =>
          compatibleRules(opening).includes(item.rule) && item.winner === hint.clue.winner).map(item => item.rule))
          .toEqual([rule]);
        expect(new Set([hint.clue.publicCard, ...hint.clue.a, ...hint.clue.b].map(card => card.id)).size).toBe(5);
      }
    }
  });

  it('优先引用可区分规则的摊牌，未验弃牌没有资格成为证据', () => {
    for (const rule of RULES) {
      let found = false;
      for (let seed = 0; seed < 40 && !found; seed++) {
        let match = startMatch(createMatch(seed, rule));
        match = applyAction(match, { kind: 'bet', token: token(match) });
        match = applyAction(match, { kind: 'fold', token: token(match) });
        const hidden = playerView(match).history;
        expect(evidenceForHint(match.clue, rule, hidden).source).toBe('example');
        const inspected = inspectHand(match);
        const revealed = evidenceForHint(inspected.clue, rule, playerView(inspected).history);
        if (revealed.source === 'inspection') {
          expect(revealed.hand).toBe(0);
          const next = nextHand(inspected);
          expect(evidenceForHint(next.clue, rule, playerView(next).history)).toEqual(revealed);
          const ready = startMatch(createMatch(seed, rule));
          const showdown = applyAction(ready, { kind: 'bet', challenge: true, token: token(ready) });
          expect(evidenceForHint(ready.clue, rule, playerView(showdown).history))
            .toEqual({ ...revealed, source: 'showdown' });
          found = true;
        }
      }
      expect(found).toBe(true);
    }
  });
});
