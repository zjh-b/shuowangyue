import { describe, expect, it } from 'vitest';
import { dealerAction } from '../src/game/dealer';
import { applyAction, canSwapHole, createMatch, currentHand, nextHand, startMatch, swapHole, token,
  type ActionKind, type Match } from '../src/game/match';
import { compareHands, RULES } from '../src/game/rules';
import { applySessionEvent, createSession, encodeSession, restoreSession } from '../src/game/session';
import { playerView } from '../src/game/views';

const act = (match: Match, kind: ActionKind, challenge = false) =>
  applyAction(match, { kind, challenge, token: token(match) });

function advanceToFifth(match: Match) {
  let current = startMatch(match);
  for (let hand = 0; hand < 4; hand++) current = nextHand(act(act(current, 'check'), 'check'));
  return current;
}

describe('后半场秘密换牌', () => {
  it('第5手起在玩家首个行动前可用，且每场只有一次', () => {
    const initial = createMatch(28, 'large');
    expect(swapHole(initial)).toBe(initial);
    const early = startMatch(initial);
    expect(swapHole(early)).toBe(early);
    const fifth = advanceToFifth(initial);
    expect(canSwapHole(fifth)).toBe(true);
    expect(applyAction(swapHole(fifth), { kind: 'bet', token: token(fifth) }).moves).toHaveLength(0);
    const acted = act(fifth, 'check');
    expect(swapHole(acted)).toBe(acted);
    const raised = act(acted, 'bet');
    expect(raised.turn).toBe(0);
    expect(swapHole(raised)).toBe(raised);
    const sixth = nextHand(act(raised, 'call'));
    expect(swapHole(sixth)).toBe(sixth);
    const afterDealerBet = act(sixth, 'bet');
    expect(canSwapHole(afterDealerBet)).toBe(true);
    const swapped = swapHole(afterDealerBet);
    expect(swapped).not.toBe(afterDealerBet);
    expect(swapHole(swapped)).toBe(swapped);
    const seventh = nextHand(act(swapped, 'call'));
    expect(swapHole(seventh)).toBe(seventh);
  });

  it('新牌来自未发牌，地猴决策仍使用原暗牌，筹码与挑战额度独立', () => {
    let changesWinner = false;
    for (const rule of RULES) {
      for (let seed = 0; seed < 40; seed++) {
        const fifth = advanceToFifth(createMatch(seed, rule));
        const original = currentHand(fifth);
        const swapped = swapHole(fifth);
        const updated = currentHand(swapped);
        expect([original.publicCard, ...original.cards.flat()].map(card => card.id)).not.toContain(updated.cards[0][1].id);
        expect(updated.cards[0][0]).toBe(original.cards[0][0]);
        expect(updated.cards[1]).toBe(original.cards[1]);
        expect(swapped.moves).toBe(fifth.moves);
        expect(swapped.banks).toBe(fifth.banks);
        expect(swapped.challengeUsed).toBe(fifth.challengeUsed);
        expect(playerView(swapped).cards[0][1]).toBe(updated.cards[0][1]);
        expect(playerView(swapped).cards[1][1]).toBeNull();
        expect(dealerAction(act(swapped, 'bet'))).toBe(dealerAction(act(fifth, 'bet')));
        expect(dealerAction(act(swapped, 'check'))).toBe(dealerAction(act(fifth, 'check')));
        const oldResult = act(fifth, 'bet', true);
        const newResult = act(swapped, 'bet', true);
        const record = playerView(newResult).history.at(-1)!;
        expect(record.swap).toEqual({ from: original.cards[0][1], to: updated.cards[0][1] });
        expect(record.winner).toBe(compareHands(rule, updated.publicCard, updated.cards[0], updated.cards[1]).winner);
        expect(newResult.banks[0] + newResult.banks[1]).toBe(64);
        changesWinner ||= oldResult.history.at(-1)!.winner !== record.winner;
      }
    }
    expect(changesWinner).toBe(true);
  });

  it('换牌可按原事件续局复现，弃牌验牌只按新牌假想判定', () => {
    let session = applySessionEvent(createSession(28, 'large'), { type: 'start' });
    const move = (seat: 0 | 1, kind: ActionKind) => {
      session = applySessionEvent(session, { type: 'move', seat, kind, challenge: false });
    };
    for (let hand = 0; hand < 4; hand++) {
      const first = session.match.turn;
      move(first, 'check');
      move(first === 0 ? 1 : 0, 'check');
      session = applySessionEvent(session, { type: 'next' });
    }
    session = applySessionEvent(session, { type: 'swap' });
    const restored = restoreSession(encodeSession(session))!;
    expect(restored).toEqual(session);
    expect(canSwapHole(restored.match)).toBe(false);
    move(0, 'bet');
    move(1, 'fold');
    const banks = session.match.banks;
    expect(playerView(session.match).history.at(-1)!.cards[1][1]).toBeNull();
    session = applySessionEvent(session, { type: 'inspect' });
    const hand = currentHand(session.match);
    expect(playerView(session.match).history.at(-1)!.inspectionVerdict)
      .toBe(compareHands(session.match.rule, hand.publicCard, hand.cards[0], hand.cards[1]).winner);
    expect(session.match.banks).toBe(banks);
  });
});
