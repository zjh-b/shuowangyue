import { expect, test, type Page } from '@playwright/test';
import { copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULES, RULE_NAMES } from '../src/game/rules';

async function startDirectly(page: Page, touch = false) {
  const entry = page.getByRole('button', { name: /^入局/ });
  const skip = page.getByRole('dialog').getByRole('button', { name: '直接开始' });
  if (touch) {
    await entry.tap();
    await skip.tap();
  } else {
    await entry.click();
    await skip.click();
  }
}

for (const rule of RULES) {
  test(`${RULE_NAMES[rule]}：正常入口打完八手并复盘`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?seed=28&rule=${rule}`);
    await expect(page.getByRole('heading', { name: '开局留下一条线索' })).toBeVisible();
    await page.getByRole('button', { name: /第1次提示/ }).click();
    await expect(page.getByText(/甲总点数/)).toBeVisible();
    if (rule === 'large') {
      await page.getByRole('button', { name: '笔记' }).click();
      await page.getByRole('combobox', { name: '当前判断' }).selectOption('near');
      await page.getByRole('button', { name: '记录判断' }).click();
      await expect(page.getByText(/已记录 近数局 · 开局前/)).toBeVisible();
    }
    await startDirectly(page);
    await expect(page.getByTestId('player-bank')).toHaveText('31');
    await expect(page.getByTestId('pot')).toHaveText('2');
    await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
    await page.getByRole('button', { name: '笔记' }).click();
    await page.getByRole('checkbox', { name: '大数局' }).check();
    await page.getByRole('textbox').fill('用摊牌结果排除一种法则');
    for (let hand = 1; hand <= 8; hand++) {
      if (hand === 1 || hand === 5) {
        await page.getByRole('button', { name: `挑战并开注 · ${hand === 1 ? 1 : 2}道` }).click();
        await expect(page.getByRole('status')).toContainText('挑战成立');
        await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(0);
        if (rule === 'large' && hand === 1) {
          await page.getByRole('combobox', { name: '当前判断' }).selectOption('large');
          await page.getByRole('button', { name: '记录判断' }).click();
          await expect(page.getByText(/已记录 大数局 · 第1手结算后/)).toBeVisible();
        }
      } else {
        const status = page.getByRole('status');
        await expect(status).toContainText('轮到你了');
        const check = page.getByRole('button', { name: '过牌', exact: true });
        if (await check.count()) await check.click();
        const call = page.getByRole('button', { name: /^跟注/ });
        const advance = page.getByRole('button', { name: /下一手|揭晓法则与复盘/ });
        await expect(call.or(advance)).toBeVisible();
        if (await call.isVisible()) {
          if (rule === 'large' && hand === 4) await page.getByRole('button', { name: '弃牌', exact: true }).click();
          else await call.click();
        }
      }
      await expect(page.getByTestId('pot')).toHaveText('0');
      await expect(page.getByText('本场法则', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: hand === 8 ? '揭晓法则与复盘' : '下一手' }).click();
    }
    await expect(page.locator('.rule-reveal h2')).toHaveText(RULE_NAMES[rule]);
    await expect(page.locator('.history details')).toHaveCount(8);
    await page.locator('.history summary').first().click();
    await expect(page.getByText(/本手判定|若按牌力比较/).first()).toBeVisible();
    if (rule === 'large') {
      const folded = page.locator('.history details').filter({ has: page.locator('summary').getByText('第4手') });
      await folded.locator('summary').click();
      await expect(folded.getByText(/暗牌未公开/)).toBeVisible();
      await expect(folded.locator('.explanation')).toHaveCount(0);
      const review = page.getByRole('region', { name: '推理复盘' });
      await expect(review.getByText('首次判断')).toBeVisible();
      await expect(review.getByText('最后判断')).toBeVisible();
      await expect(review.getByText(/开局前 · 已用提示 1 次/)).toBeVisible();
      await review.getByRole('button', { name: /第\d+手摊牌/ }).click();
      await expect(page.locator('.history details[open] summary:focus')).toHaveCount(1);
      const pendingDownload = page.waitForEvent('download');
      await review.getByRole('button', { name: '下载试玩记录' }).click();
      const download = await pendingDownload;
      const record = JSON.parse(await readFile(await download.path(), 'utf8'));
      expect(record.rule).toBe('large');
      expect(record.review.judgments).toMatchObject({
        first: { rule: 'near', hand: null, phase: 'intro' },
        latest: { rule: 'large', hand: 1, phase: 'settled' },
      });
      expect(record.hands).toHaveLength(8);
      expect(record.hands[3].cards[1][1]).toBeNull();
      expect(JSON.stringify(record)).not.toContain('用摊牌结果排除一种法则');
    }
    await page.locator('main').getByRole('button', { name: '再来一场' }).click();
    await expect(page.getByRole('button', { name: /入局/ })).toBeVisible();
    await page.getByRole('button', { name: '笔记' }).click();
    await expect(page.getByRole('textbox')).toHaveValue('');
    await expect(page.getByRole('checkbox', { name: '大数局' })).not.toBeChecked();
    expect(errors).toEqual([]);
  });
}

test('窄屏验牌可回查，弃牌的余额不会改变', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/?seed=28&rule=large');
  await startDirectly(page, true);
  for (let hand = 1; hand <= 8; hand++) {
    await expect(page.getByRole('status')).toContainText('轮到你了');
    const check = page.getByRole('button', { name: '过牌', exact: true });
    if (await check.count()) await check.tap();
    const fold = page.getByRole('button', { name: '弃牌', exact: true });
    const advance = page.getByRole('button', { name: /下一手|揭晓法则与复盘/ });
    await expect(fold.or(advance)).toBeVisible();
    if (await fold.isVisible()) { await fold.tap(); break; }
    await advance.tap();
  }
  const bank = await page.getByTestId('player-bank').innerText();
  await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
  await page.getByRole('button', { name: /验牌 · 全场1次/ }).tap();
  await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(0);
  await expect(page.getByTestId('player-bank')).toHaveText(bank);
  await page.getByRole('button', { name: /^记录/ }).tap();
  const newest = page.locator('.history details').first();
  if (!(await newest.evaluate(node => (node as HTMLDetailsElement).open))) await newest.locator('summary').tap();
  await expect(newest.getByText(/已验牌 · 假想摊牌/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

test('320px 触屏可以使用三档提示，筹码和暗牌保持原样', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/?seed=28&rule=near');
    await startDirectly(page, true);
    await page.getByRole('button', { name: '提示 3 / 3' }).tap();
    await expect(page.getByRole('heading', { name: '本场提示' })).toBeInViewport();
    await page.getByRole('button', { name: /第1次提示/ }).tap();
    await expect(page.getByText(/甲总点数/)).toBeVisible();
    await page.getByRole('button', { name: /第2次提示/ }).tap();
    await expect(page.getByRole('cell', { name: '排除', exact: true })).toHaveCount(1);
    await expect(page.getByText(/会揭开答案/)).toBeVisible();
    await page.getByRole('button', { name: /第3次提示.*揭晓法则/ }).tap();
    await expect(page.getByText('补充判例', { exact: true })).toBeVisible();
    await expect(page.locator('.hint-answer strong')).toHaveText('近数局');
    await expect(page.getByText(/本场提示已用完/)).toBeVisible();
    await page.getByRole('button', { name: '查看开局牌例' }).tap();
    await expect(page.getByRole('region', { name: '开局牌例' })).toBeInViewport();
    await page.getByRole('button', { name: '回到出牌' }).tap();
    await expect(page.getByRole('button', { name: '过牌', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '提示 0 / 3' })).toBeVisible();
    await expect(page.getByTestId('player-bank')).toHaveText('31');
    await expect(page.getByTestId('pot')).toHaveText('2');
    await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  } finally {
    await context.close();
  }
});

test('刷新恢复提示、筹码、笔记与已用挑战，并继续下一手', async ({ page }) => {
  await page.goto('/?seed=28&rule=large');
  await startDirectly(page);
  await page.getByRole('button', { name: /挑战并开注/ }).click();
  await expect(page.getByRole('status')).toContainText('挑战成立');
  const bank = await page.getByTestId('player-bank').innerText();
  await page.getByRole('button', { name: /第1次提示/ }).click();
  await page.getByRole('button', { name: '笔记' }).click();
  await page.getByRole('combobox', { name: '当前判断' }).selectOption('repeat');
  await page.getByRole('button', { name: '记录判断' }).click();
  await page.getByRole('checkbox', { name: '大数局' }).check();
  await page.getByRole('textbox').fill('第1手挑战后看过地猴暗牌');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('挑战成立');
  await expect(page.getByTestId('player-bank')).toHaveText(bank);
  await expect(page.getByTestId('pot')).toHaveText('0');
  await expect(page.getByRole('button', { name: '提示 2 / 3' })).toBeVisible();
  await expect(page.getByText(/甲总点数/)).toBeVisible();
  await page.getByRole('button', { name: '笔记' }).click();
  await expect(page.getByText(/已记录 重数局 · 第1手结算后/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '大数局' })).toBeChecked();
  await expect(page.getByRole('textbox')).toHaveValue('第1手挑战后看过地猴暗牌');
  await page.getByRole('button', { name: '下一手' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: /第 2 \/ 8 手/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('轮到你了');
  await expect(page.getByText('本半场挑战已使用')).toBeVisible();
  await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
});

test('入局先介绍规则，键盘可关闭并回到入局按钮', async ({ page }) => {
  await page.goto('/?seed=28&rule=large');
  const entry = page.getByRole('button', { name: /^入局/ });
  const dialog = page.getByRole('dialog', { name: '入局规则' });
  await entry.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '入局规则' })).toBeFocused();
  await expect(dialog.getByText('近数局', { exact: true })).toBeVisible();
  await expect(page.getByTestId('player-bank')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  await startDirectly(page);
  await expect(page.getByTestId('player-bank')).toHaveText('31');
  await expect(page.getByRole('heading', { name: /第 1 \/ 8 手/ })).toBeFocused();
});

test('320px 新手指导实练计分、规则对照和挑战，正式首手从原始额度开始', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/?seed=28&rule=near');
    await page.getByRole('button', { name: /^入局/ }).tap();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '开始新手指导' }).tap();
    await expect(dialog.getByRole('heading', { name: '读懂三张牌' })).toBeFocused();
    await expect(dialog.getByRole('img', { name: /公共牌.*春节/ })).toBeVisible();
    await dialog.getByRole('button', { name: '计算总点数' }).tap();
    await expect(dialog.getByText(/总点数.*34/)).toBeVisible();
    await dialog.getByRole('button', { name: '下一步', exact: true }).tap();
    await dialog.getByRole('button', { name: '试用规则对照' }).tap();
    await expect(dialog.getByRole('cell', { name: '排除', exact: true })).toHaveCount(1);
    await dialog.getByRole('button', { name: '下一步', exact: true }).tap();
    await expect(dialog.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
    await dialog.getByRole('button', { name: /^挑战并开注/ }).tap();
    await expect(dialog.getByRole('status')).toContainText('地猴跟注');
    await expect(dialog.getByLabel('地猴暗牌，尚未公开')).toHaveCount(0);
    expect(await dialog.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(320);
    await dialog.getByRole('button', { name: '完成指导并入局' }).tap();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('player-bank')).toHaveText('31');
    await expect(page.getByTestId('pot')).toHaveText('2');
    await expect(page.getByRole('button', { name: '提示 3 / 3' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^挑战并开注/ })).toBeVisible();
    await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('指导中途可跳过，规则册可重看且续局不自动打断', async ({ page }) => {
  await page.goto('/?seed=28&rule=large');
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: /^入局/ }).click();
  await dialog.getByRole('button', { name: '开始新手指导' }).click();
  await dialog.getByRole('button', { name: '跳过指导并入局' }).click();
  await page.getByRole('button', { name: /^挑战并开注/ }).click();
  await expect(page.getByRole('status')).toContainText('挑战成立');
  const bank = await page.getByTestId('player-bank').innerText();
  await page.getByRole('button', { name: '规则册' }).click();
  const replay = page.getByRole('button', { name: '新手指导', exact: true });
  await replay.click();
  await dialog.getByRole('button', { name: '开始新手指导' }).click();
  await dialog.getByRole('button', { name: '计算总点数' }).click();
  await dialog.getByRole('button', { name: '返回规则册' }).click();
  await expect(replay).toBeFocused();
  await expect(page.getByTestId('player-bank')).toHaveText(bank);
  await page.reload();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('挑战成立');
  await expect(page.getByRole('button', { name: '提示 3 / 3' })).toBeVisible();
  await expect(page.getByTestId('player-bank')).toHaveText(bank);
});

test('320px 后半场换牌可续局并与挑战联用，原输牌按新暗牌获胜', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/?seed=313&rule=large');
    await startDirectly(page, true);
    const swap = page.getByRole('button', { name: /秘密换暗牌/ });
    await expect(swap).toHaveCount(0);
    for (let hand = 1; hand <= 4; hand++) {
      const status = page.getByRole('status');
      await expect(status).toContainText('轮到你了');
      const check = page.getByRole('button', { name: '过牌', exact: true });
      if (await check.count()) await check.tap();
      const call = page.getByRole('button', { name: /^跟注/ });
      const next = page.getByRole('button', { name: '下一手', exact: true });
      await expect(call.or(next)).toBeVisible();
      if (await call.isVisible()) await call.tap();
      await next.tap();
    }
    await expect(page.getByRole('heading', { name: /第 5 \/ 8 手/ })).toBeVisible();
    const bank = page.getByTestId('player-bank');
    await expect(bank).toHaveText('32');
    await expect(page.getByRole('img', { name: /^你的暗牌，春节/ })).toBeVisible();
    await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
    await expect(swap).toBeInViewport({ ratio: 0.95 });
    await swap.tap();
    await expect(page.getByRole('img', { name: /^你的新暗牌，大暑/ })).toBeVisible();
    await expect(page.getByText(/已将 春节 换为 大暑/)).toBeFocused();
    await expect(bank).toHaveText('32');
    await expect(page.getByTestId('pot')).toHaveText('2');
    await page.reload();
    await expect(page.getByRole('img', { name: /^你的新暗牌，大暑/ })).toBeVisible();
    await expect(swap).toHaveCount(0);
    await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
    await page.getByRole('button', { name: '挑战并开注 · 2道' }).tap();
    await expect(page.getByRole('status')).toContainText('你拿下底池');
    await expect(bank).toHaveText('36');
    await expect(page.locator('.hand-result-totals')).toContainText(/挑战净收益\s*\+3 道/);
    const evidence = page.getByText('这手可以排除一种法则', { exact: true });
    await evidence.tap();
    await expect(page.getByRole('table', { name: '', exact: true }).getByRole('cell', { name: '排除' })).toBeVisible();
    await expect(page.getByText('剩余 3 / 3')).toBeVisible();
    await page.getByRole('button', { name: '记录 5', exact: true }).tap();
    const fifth = page.locator('#history-hand-4');
    await fifth.locator('summary').tap();
    await expect(fifth.getByText(/春节 → 大暑/)).toBeVisible();
    await page.getByRole('button', { name: '下一手', exact: true }).tap();
    await expect(page.getByRole('heading', { name: /第 6 \/ 8 手/ })).toBeVisible();
    await expect(page.getByText('本场换牌机会已用。')).toBeVisible();
    await expect(swap).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  } finally {
    await context.close();
  }
});

test('网页版分享链接省略测试参数和页面锚点', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?seed=28&rule=near#table-evidence');
  const trigger = page.getByRole('button', { name: '分享', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '分享朔望月' });
  const link = new URL('/', page.url()).href;
  await expect(dialog.getByRole('textbox', { name: '游戏链接' })).toHaveValue(link);
  await dialog.getByRole('button', { name: '复制链接' }).click();
  await expect(dialog.getByText('链接已复制。')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('单文件可另存分享，复制到独立目录后可离线加载配乐、指导、插画和续局', async ({ page, browser }, testInfo) => {
  const html = pathToFileURL(testInfo.outputPath('朔望月.html')).href;
  await copyFile(resolve('dist/朔望月-双击试玩.html'), testInfo.outputPath('朔望月.html'));
  const external: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (url !== html && /^(https?|file):/.test(url)) external.push(url);
  });
  await page.route(/^https?:/, route => route.abort());
  await page.goto(html);
  await page.getByRole('button', { name: '笔记' }).click();
  await page.getByRole('textbox').fill('仅留在原牌局的私人记录');
  await page.getByRole('button', { name: '分享', exact: true }).click();
  const share = page.getByRole('dialog', { name: '分享朔望月' });
  const pendingFile = page.waitForEvent('download');
  await share.getByRole('button', { name: '保存试玩文件' }).click();
  const download = await pendingFile;
  await share.getByRole('button', { name: '关闭' }).click();
  const sharedFile = testInfo.outputPath('shared.html');
  await download.saveAs(sharedFile);
  expect(await readFile(sharedFile, 'utf8')).not.toContain('仅留在原牌局的私人记录');
  const recipient = await browser.newContext();
  try {
    const copied = await recipient.newPage();
    await copied.route(/^https?:/, route => route.abort());
    await copied.goto(pathToFileURL(sharedFile).href);
    await expect(copied.getByRole('button', { name: /^入局/ })).toBeVisible();
    await expect(copied.locator('link[rel=icon]')).toHaveAttribute('href', /^data:image\/png/);
    await copied.getByRole('button', { name: '笔记' }).click();
    await expect(copied.getByRole('textbox')).toHaveValue('');
    await startDirectly(copied);
    await expect(copied.getByTestId('player-bank')).toHaveText('31');
  } finally {
    await recipient.close();
  }
  const music = page.locator('audio[loop]');
  await expect.poll(() => music.evaluate(audio => (audio as HTMLAudioElement).paused)).toBe(true);
  const musicToggle = page.getByRole('button', { name: '配乐关' });
  await musicToggle.click();
  await expect(page.getByRole('button', { name: '配乐开' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => music.evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  const duration = await music.evaluate(audio => (audio as HTMLAudioElement).duration);
  expect(duration).toBeGreaterThan(404);
  expect(duration).toBeLessThan(406);
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: /^入局/ }).click();
  await dialog.getByRole('button', { name: '开始新手指导' }).click();
  await expect(dialog.getByRole('img', { name: /公共牌.*春节/ })).toBeVisible();
  await dialog.getByRole('button', { name: '跳过指导并入局' }).click();
  await page.getByRole('button', { name: '线索与提示' }).click();
  await expect(page.locator('.felt .card-art img')).toHaveCount(4);
  await expect.poll(() => page.locator('.felt img').evaluateAll(nodes => nodes.every(node =>
    node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0 && node.src.startsWith('data:')))).toBe(true);
  expect(await page.locator('.felt').evaluate(node => getComputedStyle(node).backgroundImage)).toContain('data:image/webp');
  expect(await page.locator('body').evaluate(node => getComputedStyle(node, '::before').backgroundImage)).toContain('data:image/webp');
  const fonts = await page.evaluate(async () =>
    (await document.fonts.load('42px "Ma Shan Zheng"', '朔望月')).map(font => font.status));
  expect(fonts).toEqual(['loaded']);
  await page.getByRole('button', { name: /第1次提示/ }).click();
  await page.getByRole('button', { name: /挑战并开注/ }).click();
  await expect(page.getByRole('status')).toContainText('挑战成立');
  await expect.poll(() => music.evaluate(audio => (audio as HTMLAudioElement).volume)).toBe(0.22);
  await page.getByRole('button', { name: '配乐开' }).click();
  await expect.poll(() => music.evaluate(audio => (audio as HTMLAudioElement).paused)).toBe(true);
  await expect(page.getByRole('button', { name: '配乐关' })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: '下一手' })).toBeVisible();
  await expect(page.getByRole('button', { name: '提示 2 / 3' })).toBeVisible();
  expect(external).toEqual([]);
});
