import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const shots = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ipad', width: 1180, height: 820 },
]

test('capture study screens', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one set of screenshots is enough')
  mkdirSync('docs/screenshots', { recursive: true })
  await page.goto('/#/import')
  await expect(page.getByTestId('app-ready')).toBeVisible()
  await expect(page.getByText('正在读取词库')).toHaveCount(0)
  const notice = page.getByTestId('notice-ack')
  if (await notice.count()) await notice.click()
  await page.getByTestId('import-example').click()
  await page.getByTestId('import-confirm').click()
  await expect(page.getByRole('heading', { name: '已导入' })).toBeVisible()

  for (const shot of shots) {
    await page.setViewportSize({ width: shot.width, height: shot.height })
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: /好/ })).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/${shot.name}-home.png`, fullPage: true })

    await page.goto('/#/cards')
    await expect(page.getByText('Deteriorate')).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/${shot.name}-cards.png`, fullPage: true })

    await page.goto('/#/study')
    await page.getByTestId('reveal').click()
    await expect(page.getByTestId('rate-3')).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/${shot.name}-study.png` })

    await page.goto('/#/calendar')
    await expect(page.getByRole('heading', { name: '日历' })).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/${shot.name}-calendar.png`, fullPage: true })

    await page.goto('/#/progress')
    await expect(page.getByRole('heading', { name: '进展' })).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/${shot.name}-progress.png`, fullPage: true })
  }
})
