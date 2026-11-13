export type Card = { id: string; name: string; month: number; day: number; kind: '节气' | '节日' };

const terms = '立春 雨水 惊蛰 春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至 小寒 大寒'.split(' ');
const holidays: [string, number, number][] = [
  ['春节', 1, 1], ['元宵', 1, 15], ['社日', 2, 2], ['上巳', 3, 3],
  ['端午', 5, 5], ['七夕', 7, 7], ['中元', 7, 15], ['中秋', 8, 15],
  ['重阳', 9, 9], ['下元', 10, 15], ['腊八', 12, 8], ['除夕', 12, 30],
];

export const CARDS: Card[] = [
  ...terms.map((name, i): Card => ({ id: name, name, month: Math.floor(i / 2) + 1,
    day: (i < 12 ? [6, 21] : [8, 23])[i % 2], kind: '节气' })),
  ...holidays.map(([name, month, day]): Card => ({ id: name, name, month, day, kind: '节日' })),
];
export const card = (id: string): Card => {
  const found = CARDS.find(c => c.id === id);
  if (!found) throw new Error(`没有这张牌：${id}`);
  return found;
};
export const digitsOf = (c: Card): number[] => [...`${c.month}${c.day}`].map(Number);
export const dateOf = (c: Card): string => `${c.month}月${c.day}日`;

export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
