import { currentHand, type Match, type RecordEntry } from './match';
import { type Card } from './cards';
import { compareHands } from './rules';

export type PublicRecord = Omit<RecordEntry, 'cards'> & { cards: [[Card, Card], [Card, Card | null]]; inspectionVerdict?: 0 | 1 | null };
export function publicRecord(entry: RecordEntry, rule: Match['rule']): PublicRecord {
  const reveal = entry.reason === 'showdown' || entry.inspected;
  return { ...entry, cards: [entry.cards[0], [entry.cards[1][0], reveal ? entry.cards[1][1] : null]],
    inspectionVerdict: entry.inspected ? compareHands(rule, entry.publicCard, entry.cards[0], entry.cards[1]).winner : undefined };
}
export function playerView(s: Match) {
  const last = s.history.at(-1);
  const reveal = s.phase !== 'playing' && !!last && (last.reason === 'showdown' || last.inspected);
  const hand = currentHand(s);
  return { publicCard: hand.publicCard, cards: [hand.cards[0], [hand.cards[1][0], reveal ? hand.cards[1][1] : null]] as [[Card, Card], [Card, Card | null]],
    history: s.history.map(h => publicRecord(h, s.rule)) };
}
