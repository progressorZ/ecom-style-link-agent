import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const baseUrl = process.env.MOCK_URL || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '自动填写模拟页面' }).click()
  await page.locator('.task-summary h2').filter({ hasText: '模拟草稿已保存，等待人工审核' }).waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: '审核结果' }).click()
  await page.getByText('预期数据与独立模拟字段存储一致').waitFor({ timeout: 3000 })
  await expect(page.locator('.review-row').first()).toContainText('129.00')
  await expect(page.locator('.review-row').first()).toContainText('20 件')
  await expect(page.locator('.review-row').first()).toContainText('A001-BLK-S')
  await page.getByRole('button', { name: '标记内部审核通过' }).click()
  await expect(page.getByRole('button', { name: '已标记审核完成' })).toBeDisabled()
  await mkdir('output/playwright', { recursive: true })
  await page.screenshot({ path: 'output/playwright/mock-review.png', fullPage: true })
  await page.getByRole('button', { name: '商品资料' }).click()
  await page.getByLabel('黑色S库存', { exact: true }).fill('')
  await expect(page.getByLabel('黑色S库存', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: '请先处理资料' })).toBeDisabled()
  await page.getByRole('button', { name: '审核结果' }).click()
  await expect(page.getByText('尚无可审核的模拟草稿')).toBeVisible()

  // A running task cannot approve data edited after it started.
  await page.getByRole('button', { name: '恢复示例资料' }).click()
  await page.getByRole('button', { name: '商品资料' }).click()
  await page.getByRole('button', { name: '自动填写模拟页面' }).click()
  await page.getByRole('button', { name: '商品资料' }).click()
  await page.getByLabel('商品编码 / 货号', { exact: true }).fill('')
  await page.getByRole('button', { name: '审核结果' }).click()
  await page.waitForTimeout(4000)
  await expect(page.getByText('尚无可审核的模拟草稿')).toBeVisible()
  await expect(page.getByRole('button', { name: '标记内部审核通过' })).toHaveCount(0)

  // Reset also cancels pending asynchronous completion.
  await page.getByRole('button', { name: '恢复示例资料' }).click()
  await page.getByRole('button', { name: '商品资料' }).click()
  await page.getByRole('button', { name: '自动填写模拟页面' }).click()
  await page.getByRole('button', { name: '恢复示例资料' }).click()
  await page.waitForTimeout(4000)
  await expect(page.locator('.task-summary h2')).toHaveText('尚未执行')

  // A second run replaces the first; only one completion may be recorded.
  await page.getByRole('button', { name: '商品资料' }).click()
  await page.getByRole('button', { name: '自动填写模拟页面' }).click()
  await page.getByRole('button', { name: '商品资料' }).click()
  await page.getByRole('button', { name: '自动填写模拟页面' }).click()
  await page.locator('.task-summary h2').filter({ hasText: '模拟草稿已保存，等待人工审核' }).waitFor({ timeout: 8000 })
  await expect(page.locator('.events li').filter({ hasText: '独立模拟字段存储核对通过' })).toHaveCount(1)
  console.log('Mock UI regression passed: values, approval invalidation, empty stock, edit/reset cancellation and replacement run. No real platform readback tested.')
} finally {
  await browser.close()
}
