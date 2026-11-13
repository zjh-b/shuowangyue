import { firstRuleEvidence } from './hints';
import type { Judgment } from './judgments';
import { RULE_NAMES } from './rules';
import type { Session } from './session';
import { playerView } from './views';

export function judgmentTiming(judgment: Judgment) {
  if (judgment.phase === 'intro') return '开局前';
  return `第${judgment.hand + 1}手${judgment.phase === 'settled' ? '结算后' : '行动时'}`;
}

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

export function playtestSummary(session: Session): Record<string, string | number> {
  const { match } = session;
  const { judgments, evidence, hintsUsed, hintSource, showdowns, challengeHands, swapHand } = playtestReview(session);
  const hand = match.hand + 1;
  const finished = match.phase === 'finished';
  const progress = finished ? '八手已完成' : match.phase === 'intro' ? '尚未入局'
    : `第${hand}手${match.phase === 'settled' ? '已结算' : '进行中'}`;
  const judgmentLine = (entry: Judgment) => `${RULE_NAMES[entry.rule]} · ${judgmentTiming(entry)}`;

  return {
    '对局进度': progress,
    '已用提示': hintsUsed,
    ...(hintSource === 'example' && { '补充判例': '第3次提示已提供' }),
    ...(judgments && { '首次判断': judgmentLine(judgments.first), '最后判断': judgmentLine(judgments.latest) }),
    '最早区分规则的牌例': evidence ? `第${evidence.hand + 1}手${evidence.source === 'showdown' ? '摊牌' : '验牌'}` : '尚无',
    '摊牌手数': showdowns,
    '挑战手次': challengeHands.length ? challengeHands.join('、') : '未用',
    '秘密换牌': swapHand ? `第${swapHand}手` : '未用',
    ...(finished && { '本场法则': RULE_NAMES[match.rule], '终局净收益': match.banks[0] - 32 }),
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
