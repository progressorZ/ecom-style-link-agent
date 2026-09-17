import { observePddRegions } from './pdd-regions.mjs'
import { observePddFields } from './pdd-observe.mjs'
import { assessLocatorCoverage } from './pdd-locator-contract.mjs'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import locatorContract from '../config/pdd/tshirt-v1.json' with { type: 'json' }

const mode = process.argv[2] || 'linked'
if (!['initial', 'linked'].includes(mode)) throw new Error('模式只能是 initial 或 linked')

const startUrl = process.env.PDD_URL || 'https://mms.pinduoduo.com/'
const profileDir = resolve(process.env.PDD_PROFILE_DIR || '.runtime/pdd-inspection-profile')
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const reportDir = resolve('output/real-locator-verification', stamp)
await mkdir(profileDir, { recursive: true })
await mkdir(reportDir, { recursive: true })

const context = await chromium.launchPersistentContext(profileDir, {
  channel: process.env.PW_CHANNEL || 'chrome',
  headless: false,
  viewport: null
})
const page = context.pages()[0] || await context.newPage()
const terminal = createInterface({ input, output })

try {
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  output.write(`\n定位验证模式：${mode === 'initial' ? '空白初始状态' : '联动完全展开状态'}\n`)
  output.write('请手工进入女装 T 恤发布页并准备对应状态。程序不会填写、保存或发布。\n')
  await terminal.question('准备完成后回到终端按 Enter：')

  const target = context.pages().find((candidate) => candidate.url().includes('mms.pinduoduo.com/goods/')) || context.pages().at(-1) || page
  const targetUrl = new URL(target.url())
  if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== locatorContract.scope.host || targetUrl.pathname !== locatorContract.scope.path) {
    throw new Error(`当前页面不是已登记的商品编辑页：${targetUrl.origin}${targetUrl.pathname}`)
  }

  const fields = locatorContract.fields.filter((field) => mode === 'linked' || !field.appearsAfter?.length)
  const result = await target.evaluate(observePddFields, { fields, forbiddenActions: locatorContract.safety.forbiddenActions, allowedAction: locatorContract.safety.allowedTerminalAction })

  const saveAction = result.visibleActionCounts.find((item) => item.action === locatorContract.safety.allowedTerminalAction)
  const coverage = assessLocatorCoverage(result.fieldResults, saveAction?.count || 0, fields)
  const failures = coverage.fields.filter((field) => field.status !== 'unique')
  const forbiddenVisible = result.visibleActionCounts.filter((item) => locatorContract.safety.forbiddenActions.includes(item.action) && item.count > 0)
  const report = {
    checkedAt: new Date().toISOString(),
    mode,
    page: `${targetUrl.origin}${targetUrl.pathname}`,
    contractVersion: locatorContract.version,
    ...coverage,
    regionInventory: await target.evaluate(observePddRegions),
    summary: { checkedFields: result.fieldResults.length, uniqueFields: result.fieldResults.filter((field) => field.locatorStatus === 'unique').length, passedFields: result.fieldResults.length - failures.length, failures: failures.length },
    fields: coverage.fields,
    actions: {
      saveDraftCount: saveAction?.count || 0,
      forbiddenVisible,
      note: '检测到禁用发布按钮只证明门禁目标存在；本程序没有点击任何按钮。'
    }
  }
  await writeFile(`${reportDir}/report.json`, JSON.stringify(report, null, 2))
  await target.screenshot({ path: `${reportDir}/page.png`, fullPage: true })

  output.write(`\n检查字段：${report.summary.checkedFields}\n`)
  output.write(`唯一定位：${report.summary.uniqueFields}\n`)
  output.write(`失败或歧义：${report.summary.failures}\n`)
  output.write(`保存草稿按钮数量：${report.actions.saveDraftCount}\n`)
  output.write(`基础字段可操作检查：${report.basicFieldsReady ? '通过' : '未通过'}\n`)
  output.write(report.coverageNote + '\n')
  output.write(`结果：${report.ready ? '通过' : '未通过'}\n`)
  if (failures.length) failures.forEach((field) => output.write(`- ${field.label}: ${field.status}（label=${field.labelCount}, control=${field.controlCount}）\n`))
  output.write(`报告：${reportDir}/report.json\n`)
  output.write(`截图：${reportDir}/page.png\n`)
  await terminal.question('按 Enter 关闭浏览器：')
  if (!report.ready) process.exitCode = 2
} finally {
  terminal.close()
  await context.close()
}
