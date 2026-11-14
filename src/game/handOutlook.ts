import { CARDS, type Card } from './cards';
import { compareScores, scoreCards, type Rule } from './rules';

export type HandKnowledge = {
  publicCard: Card;
  mine: [Card, Card];
  opponents: { upcard: Card; active: boolean }[];
  discarded?: Card | null;
};

function unseenCards({ publicCard, mine, opponents, discarded }: HandKnowledge) {
  const visible = [publicCard, ...mine, ...opponents.map(player => player.upcard)];
  if (discarded) visible.push(discarded);
  const blocked = new Set(visible.map(item => item.id));
  return CARDS.filter(item => !blocked.has(item.id));
}

export function handOutlook(rule: Rule, information: HandKnowledge) {
  const score = scoreCards([information.publicCard, ...information.mine]);
  const unseen = unseenCards(information);
  const opponents = information.opponents.filter(player => player.active);
  const outcomes = opponents.map(player => unseen.map(hole => compareScores(rule, score,
    scoreCards([information.publicCard, player.upcard, hole])).winner));
  const used = new Set<number>();
  let wins = 0, ties = 0, losses = 0, cases = 0, shares = 0;

  // Allocate distinct unseen cards to active opponents. Marginalizing folded hands
  // leaves the same uniform distribution over these assignments.
  function assign(opponent: number, equal: number, beaten: boolean) {
    if (opponent === opponents.length) {
      cases++;
      if (beaten) losses++;
      else {
        if (equal) ties++;
        else wins++;
        shares += 1 / (equal + 1);
      }
      return;
    }
    for (let index = 0; index < unseen.length; index++) {
      if (used.has(index)) continue;
      const outcome = outcomes[opponent][index];
      used.add(index);
      assign(opponent + 1, equal + Number(outcome === null), beaten || outcome === 1);
      used.delete(index);
    }
  }
  assign(0, 0, false);
  return { score, wins, ties, losses, cases, equity: shares / cases };
}

export function swapOutlook(rule: Rule, information: HandKnowledge) {
  const score = scoreCards([information.publicCard, ...information.mine]);
  const possible = unseenCards(information);
  let improves = 0, same = 0, worsens = 0;
  for (const replacement of possible) {
    const updated = scoreCards([information.publicCard, information.mine[0], replacement]);
    const { winner } = compareScores(rule, updated, score);
    if (winner === 0) improves++;
    else if (winner === null) same++;
    else worsens++;
  }
  return { cases: possible.length, improves, same, worsens };
}

export function callThreshold(pot: number, cost: number) {
  return cost > 0 ? cost / (pot + cost) : null;
}
