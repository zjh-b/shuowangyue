import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('手机端局中可填反馈，失败后能重试，摘要由玩家选择', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const submissions: Record<string, unknown>[] = [];
    await page.route('https://formspree.io/f/**', async route => {
      expect(route.request().url()).toBe('https://formspree.io/f/playwrightdemo');
      submissions.push(route.request().postDataJSON());
      await route.fulfill({
        status: submissions.length === 1 ? 503 : 200,
        json: { ok: submissions.length !== 1 },
      });
    });
    await page.goto('/?seed=28&rule=large');
    await page.getByRole('button', { name: /^入局/ }).tap();
    await page.getByRole('button', { name: '直接开始' }).tap();
    await page.getByRole('button', { name: '笔记', exact: true }).tap();
    await page.getByRole('textbox').fill('仅写在本机的私人笔记');
    await page.getByRole('button', { name: '反馈', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: '试玩反馈' });
    const attach = dialog.getByRole('checkbox', { name: '附上本场对局摘要' });
    await expect(attach).not.toBeChecked();
    await dialog.getByText('预览对局摘要', { exact: true }).tap();
    await expect(dialog.getByText('第1手进行中', { exact: true })).toBeVisible();
    await expect(dialog.getByText('本场法则', { exact: true })).toHaveCount(0);
    await dialog.getByLabel('哪里最影响体验？').selectOption({ label: '猜出规则后仍很难赢' });
    await dialog.getByLabel('想补充什么？').fill('希望能看懂挑战时机');
    expect(submissions).toHaveLength(0);
    const submit = dialog.getByRole('button', { name: '提交反馈', exact: true });
    await submit.tap();
    await expect(dialog.getByRole('status')).toContainText('提交失败');
    await expect(dialog.getByLabel('想补充什么？')).toHaveValue('希望能看懂挑战时机');
    expect(submissions[0]).not.toHaveProperty('summary');
    await attach.check();
    await submit.tap();
    await expect(dialog.getByRole('status')).toContainText('反馈已提交');
    expect(submissions[1]).toMatchObject({ message: '希望能看懂挑战时机' });
    expect(JSON.parse(String(submissions[1].summary))).toMatchObject({ '对局进度': '第1手进行中' });
    expect(JSON.stringify(submissions)).not.toContain('仅写在本机的私人笔记');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await dialog.getByRole('button', { name: '关闭', exact: true }).tap();
    await expect(page.getByTestId('player-bank')).toHaveText('31');
  } finally {
    await context.close();
  }
});

test('离线版可填写并下载反馈，期间不访问网络', async ({ page }) => {
  const external: string[] = [];
  await page.route(/^https?:/, route => {
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(resolve('dist/朔望月-双击试玩.html')).href);
  await page.getByRole('button', { name: '反馈', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '试玩反馈' });
  await expect(dialog.getByRole('button', { name: '提交反馈', exact: true })).toHaveCount(0);
  await dialog.getByLabel('哪里最影响体验？').selectOption({ label: '牌局节奏慢或重复' });
  await dialog.getByLabel('想补充什么？').fill('离线试玩反馈');
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载反馈', exact: true }).click();
  const download = await pending;
  const data = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(data).toMatchObject({ message: '离线试玩反馈' });
  expect(data).not.toHaveProperty('summary');
  expect(external).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '反馈', exact: true })).toBeFocused();
});
