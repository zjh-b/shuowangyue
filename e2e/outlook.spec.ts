import { expect, test } from '@playwright/test';

test('320px 估牌根据个人判断显示，变更法则与刷新后可继续下注', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/?seed=28&rule=large');
    await page.getByRole('button', { name: /^入局/ }).tap();
    await page.getByRole('button', { name: '直接开始' }).tap();
    await page.getByText('按我的判断看本手', { exact: true }).tap();
    const guide = page.getByRole('region', { name: '本手估牌' });
    await expect(guide.getByText('选择你推测的法则，再查看本手牌力。')).toBeVisible();
    const selector = guide.getByRole('combobox', { name: '估牌法则' });
    await selector.selectOption('near');
    await expect(guide.getByText(/距24差/)).toBeVisible();
    await expect(guide.getByLabel('整桌牌力估算')).toContainText('领先');
    await expect(page.getByTestId('player-bank')).toHaveText('31');
    await expect(page.getByTestId('pot')).toHaveText('2');
    await expect(page.getByLabel('地猴暗牌，尚未公开')).toHaveCount(1);
    await expect(page.getByText('本场法则', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '笔记', exact: true }).tap();
    await expect(page.getByRole('combobox', { name: '当前判断' })).toHaveValue('near');
    await page.reload();
    await page.getByText('按我的判断看本手', { exact: true }).tap();
    await expect(selector).toHaveValue('near');
    await selector.selectOption('large');
    await expect(guide.getByText(/本手总点/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole('button', { name: '挑战并开注 · 1道' }).tap();
    await expect(page.getByRole('status')).toContainText('挑战成立');
  } finally {
    await context.close();
  }
});
