import { firstRuleEvidence } from './hints';
import type { Judgment } from './judgments';
import type { Session } from './session';
import { playerView } from './views';

export function playtestReview({ match, hints, judgments }: Session) {
  const history = playerView(match).history;
  return {
    judgments,
    evidence: firstRuleEvidence(match.clue, history),
    hintsUsed: hints.used,
    hintSource: hints.evidence?.source,
    showdowns: history.filter(entry => entry.reason === 'showdown').length,
    challengeHands: history.filter(entry => entry.challenged).map(entry => entry.hand + 1),
    swapHand: match.holeSwap ? match.holeSwap.hand + 1 : null,
  };
}

export function playtestRecord(session: Session) {
  const { match } = session;
  if (match.phase !== 'finished') return null;
  const { evidence, judgments, ...review } = playtestReview(session);
  const numberHand = (judgment: Judgment) => ({
    ...judgment, hand: judgment.phase === 'intro' ? null : judgment.hand + 1,
  });
  return {
    version: 1,
    rule: match.rule,
    openingClue: match.clue,
    net: match.banks[0] - 32,
    review: {
      ...review,
      evidence: evidence ? { ...evidence, hand: evidence.hand + 1 } : null,
      judgments: judgments ? { first: numberHand(judgments.first), latest: numberHand(judgments.latest) } : null,
    },
    hands: playerView(match).history.map(entry => ({ ...entry, hand: entry.hand + 1 })),
  };
}
