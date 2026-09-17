import test from 'node:test'
import assert from 'node:assert/strict'
import { assertActionAllowed, assertPddEditorUrl, buildFieldPlan, buildVariantRowKey, tshirtLocatorContract } from './pdd-locator-contract.mjs'

test('accepts only the captured Pinduoduo editor route', () => {
  assert.doesNotThrow(() => assertPddEditorUrl('https://mms.pinduoduo.com/goods/goods_add/index?type=add'))
  assert.throws(() => assertPddEditorUrl('https://example.com/goods/goods_add/index'))
})

test('permits saving a draft and blocks platform publication', () => {
  assert.doesNotThrow(() => assertActionAllowed('保存草稿'))
  assert.throws(() => assertActionAllowed('提交并上架'), /禁止自动执行/)
})

test('marks linked fields by exact visible label', () => {
  const labels = tshirtLocatorContract.fields.map((field) => field.label).filter((label) => !['材质', '成分含量', '风格'].includes(label))
  const before = buildFieldPlan(labels)
  assert.equal(before.find((field) => field.key === 'attributes.material').status, 'not_visible')
  const after = buildFieldPlan([...labels, '材质', '成分含量', '风格'])
  assert.ok(after.every((field) => field.status === 'unique_label'))
})

test('uses color and size as the stable variant row identity', () => {
  assert.equal(buildVariantRowKey('白色', 'S'), '白色::S')
  assert.throws(() => buildVariantRowKey('白色', ''))
})

 test('does not treat arbitrary text inputs as valid platform controls or complete R1', async () => {
  const { assessLocatorCoverage, tshirtLocatorContract: config } = await import('./pdd-locator-contract.mjs')
  const fake = config.fields.map((field) => ({ key: field.key, status: 'unique', control: { tag: 'input', type: 'text', placeholder: '', disabled: false } }))
  const report = assessLocatorCoverage(fake, 1)
  assert.equal(report.basicFieldsReady, false)
  assert.equal(report.ready, false)
  const matched = config.fields.map((field) => ({ key: field.key, status: 'unique', control: { tag: field.control === 'text' ? 'input' : 'select', type: 'text', placeholder: field.placeholderContains || field.placeholder || '', multiple: true, disabled: false } }))
  assert.equal(assessLocatorCoverage(matched, 1).basicFieldsReady, true)
  assert.equal(assessLocatorCoverage(matched, 1).ready, false)
  assert.equal(assessLocatorCoverage(matched.slice(1), 1).basicFieldsReady, false)
  assert.equal(assessLocatorCoverage(matched, 2).basicFieldsReady, false)
 })
