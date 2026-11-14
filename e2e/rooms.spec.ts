import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

function openHands(page: Page) {
  return page.getByRole('region', { name: '联机牌桌' });
}

for (const count of [2, 4] as const) {
  test(`${count} 个独立浏览器座位打完八手并复盘`, async ({ browser, baseURL }) => {
    const contexts = await Promise.all(Array.from({ length: count }, (_, index) => browser.newContext(
      index === 0 ? { viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }
        : { viewport: { width: index === 1 ? 320 : 390, height: 844 }, isMobile: true, hasTouch: true },
    )));
    const errors: string[] = [];
    try {
      const pages = await Promise.all(contexts.map(context => context.newPage()));
      for (const page of pages) page.on('pageerror', error => errors.push(error.message));
      const [host, ...guests] = pages;
      await host.goto(baseURL!);
      await host.getByRole('link', { name: '联机对局', exact: true }).click();
      await host.getByRole('radio', { name: count === 2 ? '双人桌' : '四人桌' }).check();
      await host.getByRole('textbox', { name: '称呼' }).fill('月照');
      await host.getByRole('button', { name: '开一张桌' }).click();
      const invitation = host.getByRole('textbox', { name: '邀请链接' });
      await expect(invitation).toBeVisible();
      const link = await invitation.inputValue();
      const code = new URL(link).searchParams.get('room');
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect([...new URL(link).searchParams.keys()]).toEqual(['room']);
      await host.getByRole('button', { name: '复制邀请链接' }).click();
      expect(await host.evaluate(() => navigator.clipboard.readText())).toBe(link);
      await expect(host.getByRole('button', { name: '开始对局' })).toBeDisabled();
      await Promise.all(guests.map(async (guest, index) => {
        await guest.goto(link);
        await expect(guest.getByRole('textbox', { name: '房间码' })).toHaveValue(code!);
        await guest.getByRole('textbox', { name: '称呼' }).fill(['听松', '折桂', '归舟'][index]);
        await guest.getByRole('button', { name: '加入牌桌' }).click();
        await expect(guest.getByRole('list', { name: '已入座玩家' })).toBeVisible();
      }));
      await expect(host.getByText(`${count} / ${count} 已入座`)).toBeVisible();
      if (process.env.SHUOWANG_CAPTURE && count === 4) {
        const folder = resolve(process.env.SHUOWANG_CAPTURE);
        await mkdir(folder, { recursive: true });
        await host.screenshot({ path: resolve(folder, 'lobby.png'), animations: 'disabled' });
      }
      await host.getByRole('button', { name: '开始对局' }).click();
      for (const page of pages) {
        await expect(openHands(page)).toBeVisible();
        await expect(openHands(page).getByRole('img', { name: /^你的暗牌/ })).toBeVisible();
        await expect(openHands(page).getByText('盖着', { exact: true })).toHaveCount(count - 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      const capture = process.env.SHUOWANG_CAPTURE;
      if (capture && count === 4) {
        await host.screenshot({ path: resolve(capture, 'desktop.png'), animations: 'disabled' });
        await guests[0].screenshot({ path: resolve(capture, 'mobile.png'), animations: 'disabled' });
      }

      const seatPages = [host];
      expect(new URL(host.url()).searchParams.get('room')).toBe(code);
      // The invites were concurrent. Read the actual join order from the room view.
      const order = await Promise.all(pages.map(async page => {
        const response = await page.waitForResponse(response => response.ok() && response.url().endsWith('/api/rooms/' + code)
          && response.request().method() === 'GET');
        const view = await response.json();
        expect(view.table.rule).toBeNull();
        expect(view.table.cards.filter((pair: unknown[]) => pair[1] !== null)).toHaveLength(1);
        return { page, seat: view.seat as number };
      }));
      for (const { page, seat } of order) seatPages[seat] = page;

      for (let hand = 0; hand < 8; hand++) {
        const first = hand % count;
        await expect(openHands(host).getByRole('heading', { name: `第 ${hand + 1} / 8 手` })).toBeVisible();
        const next = host.getByRole('button', { name: hand === 7 ? '揭晓法则与复盘' : '下一手', exact: true });
        if (hand === 4) {
          const own = openHands(host).getByRole('img', { name: /^你的暗牌/ });
          await expect(own).toBeVisible();
          const old = await own.getAttribute('aria-label');
          const swappedResponse = host.waitForResponse(response => response.ok() && response.url().endsWith('/api/rooms/' + code)
            && response.request().method() === 'POST' && response.request().postDataJSON()?.kind === 'swap');
          await host.getByRole('button', { name: /秘密换暗牌/ }).click();
          await swappedResponse;
          await expect(host.getByText('本场换牌机会已用。')).toBeVisible();
          await expect(own).not.toHaveAttribute('aria-label', old!);
          const swapped = await own.getAttribute('aria-label');
          await host.reload();
          await expect(own).toHaveAttribute('aria-label', swapped!);
          await expect(host.getByRole('button', { name: /秘密换暗牌/ })).toHaveCount(0);
          await expect(openHands(guests[0]).getByText('盖着', { exact: true })).toHaveCount(count - 1);
        }

        for (let offset = 0; offset < count; offset++) {
          const current = seatPages[(first + offset) % count];
          const action = hand === 0 ? (offset === 0 ? /^开注/ : offset === count - 1 ? /^弃牌$/ : /^跟注/) : /^过牌$/;
          await openHands(current).getByRole('button', { name: action }).click();
        }
        await expect(next).toBeVisible();
        if (hand === 0) {
          await expect(openHands(host).getByText('盖着', { exact: true })).toHaveCount(1);
        }
        await next.click();
      }

      for (const page of pages) {
        await expect(page.getByText('本场法则', { exact: true })).toBeVisible();
        const rankings = page.getByRole('list', { name: '最终筹码' }).getByRole('listitem');
        await expect(rankings).toHaveCount(count);
        const totals = await rankings.locator('b').allTextContents();
        expect(totals.reduce((sum, value) => sum + Number.parseInt(value, 10), 0)).toBe(count * 32);
      }
      await host.getByRole('button', { name: '记录 8', exact: true }).click();
      await expect(host.locator('.room-history details')).toHaveCount(8);
      await host.getByRole('button', { name: '再来一场', exact: true }).click();
      await expect(openHands(host).getByRole('heading', { name: '第 1 / 8 手' })).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  });
}
