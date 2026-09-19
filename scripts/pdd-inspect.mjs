import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {discoverPddSelectOptions} from './pdd-option-discovery.mjs'

const startUrl = process.argv[2] || 'https://mms.pinduoduo.com/'
const parsedUrl = new URL(startUrl)
if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'mms.pinduoduo.com') {
  throw new Error('只允许检查 https://mms.pinduoduo.com 页面')
}

const profileDir = resolve(process.env.PDD_PROFILE_DIR || '.runtime/pdd-inspection-profile')
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const outputDir = resolve('output/real-discovery', stamp)
await mkdir(profileDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

const context = await chromium.launchPersistentContext(profileDir, {
  channel: process.env.PW_CHANNEL || 'chrome',
  headless: false,
  viewport: null
})
const page = context.pages()[0] || await context.newPage()
const terminal = createInterface({ input, output })

try {
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  output.write('\n已打开独立的真实页面勘察浏览器。请手工登录并进入目标“发布新商品”页面。\n')
  output.write('此脚本只读取页面结构和截图，不填写字段，不保存草稿，不提交商品。\n')
  await terminal.question('页面准备好后回到终端按 Enter 开始采集：')

  const target = context.pages().find((candidate) => candidate.url().includes('mms.pinduoduo.com/goods/')) || context.pages().at(-1) || page
  await target.bringToFront()
  await target.waitForLoadState('domcontentloaded').catch(() => {})

  const observation = await target.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const visible = (element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0
    }
    const texts = (selector) => [...document.querySelectorAll(selector)].filter(visible).map((element) => clean(element.textContent)).filter(Boolean)
    const visibleInputs = [...document.querySelectorAll('input,textarea,select')].filter(visible)
    const describeInput = (element) => ({
      index: visibleInputs.indexOf(element),
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type') || null,
      name: element.getAttribute('name') || null,
      placeholder: clean(element.getAttribute('placeholder')) || null,
      ariaLabel: clean(element.getAttribute('aria-label')) || null,
      disabled: element.disabled
    })
    const fieldCandidates = [...document.querySelectorAll('label')].filter(visible).map((label) => {
      const explicit = label.htmlFor ? document.getElementById(label.htmlFor) : null
      if (explicit && visibleInputs.includes(explicit)) return { label: clean(label.textContent), relation: 'for', candidates: [describeInput(explicit)] }
      let container = label
      for (let depth = 0; depth <= 6 && container; depth += 1, container = container.parentElement) {
        const candidates = [...container.querySelectorAll('input,textarea,select')].filter((element) => visibleInputs.includes(element))
        if (candidates.length) return { label: clean(label.textContent), relation: `ancestor:${depth}`, candidates: candidates.slice(0, 12).map(describeInput) }
      }
      return { label: clean(label.textContent), relation: 'none', candidates: [] }
    }).filter((item) => item.label)
    return {
      title: document.title,
      headings: texts('h1,h2,h3,h4').slice(0, 100),
      labels: texts('label').slice(0, 300),
      buttons: texts('button,[role="button"]').slice(0, 300),
      inputs: visibleInputs.slice(0, 500).map((element) => ({
        ...describeInput(element),
        hasValue: Boolean(element.value),
      })),
      fieldCandidates
    }
  })

  const targetUrl = new URL(target.url())
  const report = {
    capturedAt: new Date().toISOString(),
    page: `${targetUrl.origin}${targetUrl.pathname}`,
    ...observation,
    note: '本地只读页面勘察；未记录输入值、Cookie、localStorage 或完整 HTML。'
  }
  const selectOptions = await discoverPddSelectOptions(target)
  await target.screenshot({ path: `${outputDir}/page.png`, fullPage: true })
  await writeFile(`${outputDir}/controls.json`, JSON.stringify(report, null, 2))
  await writeFile(`${outputDir}/select-options.json`, JSON.stringify(selectOptions, null, 2))
  const ambiguous = report.fieldCandidates.filter((field) => field.candidates.length !== 1)
  await writeFile(`${outputDir}/locator-audit.json`, JSON.stringify({
    capturedAt: report.capturedAt,
    page: report.page,
    exactAssociations: report.fieldCandidates.length - ambiguous.length,
    ambiguousAssociations: ambiguous.length,
    fields: report.fieldCandidates
  }, null, 2))
  output.write(`\n采集完成：\n- ${outputDir}/page.png\n- ${outputDir}/controls.json\n`)
  output.write(`- ${outputDir}/locator-audit.json\n`)
  output.write(`- ${outputDir}/select-options.json（自动读取下拉选项；不会选择或保存）\n`)
  await terminal.question('按 Enter 关闭勘察浏览器：')
} finally {
  terminal.close()
  await context.close()
}
