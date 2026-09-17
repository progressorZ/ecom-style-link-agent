import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('output/real-discovery')
const requested = process.argv[2]
const directories = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
const captureDir = requested ? resolve(requested) : resolve(root, directories.at(-1) || '')
const report = JSON.parse(await readFile(`${captureDir}/controls.json`, 'utf8'))

const expected = [
  '商品轮播图', '商品标题', '品牌', '面料俗称', '流行元素', '主风格', '袖长', '服装版型', '衣长', '领型', '袖型',
  '适用年龄', '上市时节', '是否加绒', '平方克重', '商品货号', '商品资质', '商品详情', '商品规格',
  '价格及库存', '商品参考价', '满件折扣', '承诺发货时间', '7天无理由退货'
]
const normalizedLabels = report.labels.map((label) => label.replace(/^重要/, '').replace(/^\*\s*/, ''))
const coverage = expected.map((field) => ({ field, observed: normalizedLabels.some((label) => label.includes(field)) }))
const placeholders = Object.entries(report.inputs.reduce((result, input) => {
  const key = input.placeholder || '(无占位符)'
  result[key] = (result[key] || 0) + 1
  return result
}, {})).map(([placeholder, count]) => ({ placeholder, count, ambiguous: count > 1 }))
const forbiddenButtonVisible = report.buttons.includes('提交并上架')
const summary = {
  captureDir,
  capturedAt: report.capturedAt,
  page: report.page,
  counts: { labels: report.labels.length, buttons: report.buttons.length, inputs: report.inputs.length },
  coverage,
  placeholders,
  safety: {
    forbiddenButtonVisible,
    rule: '真实 Adapter 必须拒绝点击“提交并上架”；v0.1 只允许保存草稿。'
  },
  readyForStableLocatorImplementation: Array.isArray(report.fieldCandidates),
  nextAction: Array.isArray(report.fieldCandidates)
    ? '审查 locator-audit.json 中的一对一关联，再实现真实 Adapter。'
    : '使用升级后的 npm run pdd:inspect 再采集一次，以取得标签与控件的 DOM 关联。'
}
await writeFile(`${captureDir}/analysis.json`, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
