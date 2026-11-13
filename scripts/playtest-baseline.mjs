import { createServer } from 'vite';

const seedArgument = process.argv.slice(2).find(argument => argument !== '--json');
const seedsPerRule = Number(seedArgument ?? 300);
if (!Number.isInteger(seedsPerRule) || seedsPerRule < 1) throw new Error('请输入正整数作为每种法则的牌序数量。');

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const [{ simulateMatch, STRATEGIES }, { RULES, RULE_NAMES }, { firstRuleEvidence }, { playerView }] = await Promise.all([
    server.ssrLoadModule('/src/game/simulation.ts'),
    server.ssrLoadModule('/src/game/rules.ts'),
    server.ssrLoadModule('/src/game/hints.ts'),
    server.ssrLoadModule('/src/game/views.ts'),
  ]);
  const names = { fold: '有注就弃', passive: '过牌／跟注', follow: '地猴过牌后开注', evidence: '按公开信息估牌' };
  const rows = [];
  for (const rule of RULES) {
    for (const strategy of STRATEGIES) {
      let net = 0, wins = 0, ties = 0, showdowns = 0, challenges = 0, evidenceCount = 0, firstHandTotal = 0;
      for (let seed = 0; seed < seedsPerRule; seed++) {
        const match = simulateMatch(seed, rule, strategy);
        const profit = match.banks[0] - 32;
        net += profit;
        wins += Number(profit > 0);
        ties += Number(profit === 0);
        showdowns += match.history.filter(entry => entry.reason === 'showdown').length;
        challenges += match.history.filter(entry => entry.challenged).length;
        const evidence = firstRuleEvidence(match.clue, playerView(match).history);
        if (evidence) {
          evidenceCount++;
          firstHandTotal += evidence.hand + 1;
        }
      }
      rows.push({
        法则: RULE_NAMES[rule], 策略: names[strategy], 场数: seedsPerRule, 平均净收益: (net / seedsPerRule).toFixed(2),
        胜率: percent(wins, seedsPerRule), 平局率: percent(ties, seedsPerRule),
        摊牌率: percent(showdowns, 8 * seedsPerRule), 场均挑战: (challenges / seedsPerRule).toFixed(2),
        获得区分证据: percent(evidenceCount, seedsPerRule),
        首次证据平均手数: evidenceCount ? (firstHandTotal / evidenceCount).toFixed(2) : '—',
      });
    }
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else console.table(rows);
} finally {
  await server.close();
}

function percent(value, total) {
  return `${(100 * value / total).toFixed(1)}%`;
}
