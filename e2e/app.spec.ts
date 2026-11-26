import { expect, test, type Page } from '@playwright/test'

async function dismissNotice(page: Page) {
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByText('正在读取词库')).toHaveCount(0)
  const notice = page.getByTestId('notice-ack')
  if (await notice.count()) {
    await notice.click()
    await expect(notice).toHaveCount(0)
  }
}

async function createCard(page: Page, front: string, back: string) {
  await page.locator('.sidebar').getByRole('link', { name: '词卡' }).click()
  await page.getByTestId('add-card').click()
  await page.getByTestId('front-input').fill(front)
  await page.getByTestId('back-input').fill(back)
  await page.getByTestId('save-card').click()
  await expect(page.getByRole('heading', { name: front })).toBeVisible()
}

test('create, review and keep data after reload', async ({ page }) => {
  await page.goto('/')
  await dismissNotice(page)
  await createCard(page, 'Harbour', '港口')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Harbour' })).toBeVisible()

  await page.locator('.sidebar').getByRole('link', { name: '学习' }).click()
  await expect(page.getByTestId('study-front')).toContainText('Harbour')
  await page.getByTestId('reveal').click()
  await expect(page.getByText('港口')).toBeVisible()
  await page.getByTestId('rate-3').click()
  await expect(page.getByRole('heading', { name: /结束了/ })).toBeVisible()
  const bridge = page.getByRole('heading', { name: '闪卡这一段结束了' })
  if (await bridge.isVisible()) await page.getByRole('button', { name: '跳过练习' }).click()
  await expect(page.getByRole('heading', { name: '这一轮结束了' })).toBeVisible()

  await page.getByTestId('mode-review').click()
  await expect(page.getByRole('heading', { name: '没有到期的卡片' })).toBeVisible()
  await page.locator('.sidebar').getByRole('link', { name: '进展' }).click()
  await expect(page.getByText('Harbour')).toBeVisible()
})

test('previews and imports the starter pack', async ({ page }) => {
  await page.goto('/#/import')
  await dismissNotice(page)
  await page.getByTestId('import-example').click()
  await expect(page.getByRole('heading', { name: '可以导入' })).toBeVisible()
  await expect(page.getByText('Deteriorate', { exact: true })).toBeVisible()
  await page.getByTestId('import-confirm').click()
  await expect(page.getByRole('heading', { name: '已导入' })).toBeVisible()
  await page.locator('.sidebar').getByRole('link', { name: '词卡' }).click()
  await expect(page.getByRole('link', { name: 'Deteriorate' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Deteriorate' })).toBeVisible()
})

test('works offline after the service worker is installed', async ({ page, context }) => {
  await page.goto('/')
  await dismissNotice(page)
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker?.getRegistration()
    return Boolean(registration?.active)
  })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await createCard(page, 'OfflineWord', '离线')

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OfflineWord' })).toBeVisible()
  await page.locator('.sidebar').getByRole('link', { name: '词卡' }).click()
  await page.getByTestId('add-card').click()
  await page.getByTestId('front-input').fill('SecondOffline')
  await page.getByTestId('back-input').fill('第二')
  await page.getByTestId('save-card').click()
  await expect(page.getByRole('heading', { name: 'SecondOffline' })).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SecondOffline' })).toBeVisible()
  await page.locator('.sidebar').getByRole('link', { name: '词卡' }).click()
  await expect(page.getByText('OfflineWord')).toBeVisible()
})
