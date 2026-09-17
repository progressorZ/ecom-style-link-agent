import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { observePddFields } from './pdd-observe.mjs'
import { assessLocatorCoverage } from './pdd-locator-contract.mjs'

const field = { key: 'test', label: '面料', control: 'combobox' }
const shell = (content) => `<div data-testid="beast-core-form-item"><div><label>面料</label></div>${content}</div>`
const select = (extra = '', multiple = false) => `<div data-testid="beast-core-select"><div data-testid="beast-core-select-header"><span class="${multiple ? 'ST_selectValueMultiple_5-188-0' : 'ST_selectValueSingle_5-188-0'}"><input data-testid="beast-core-select-htmlInput" type="text" ${extra}></span></div></div>`
function observe(html, fields = [field]) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 100, height: 20 })
  const result = dom.window.eval(`(${observePddFields.toString()})`)({ fields, forbiddenActions: ['提交并上架'], allowedAction: '保存草稿' })
  dom.window.close()
  return JSON.parse(JSON.stringify(result))
}

test('recognizes observed custom select without a combobox role, without collecting its value', () => {
  const result = observe(shell(select('value="PRIVATE_TEST_VALUE"')))
  const report = assessLocatorCoverage(result.fieldResults, 1, [field])
  assert.equal(report.basicFieldsReady, true)
  assert.equal(JSON.stringify(result).includes('PRIVATE_TEST_VALUE'), false)
  assert.equal(report.ready, false)
})
test('a plain input or partial component signature cannot masquerade as a select', () => {
  for (const html of ['<input type="text">', '<div data-testid="beast-core-select"><input data-testid="beast-core-select-htmlInput"></div>']) {
    const result = observe(shell(html))
    assert.equal(assessLocatorCoverage(result.fieldResults, 1, [field]).basicFieldsReady, false)
  }
})
test('identifies multiple selection only with corresponding component evidence', () => {
  const multiple = { ...field, control: 'multi_combobox' }
  for (const supported of [true, false]) {
    const result = observe(shell(select('', supported)), [multiple])
    assert.equal(assessLocatorCoverage(result.fieldResults, 1, [multiple]).basicFieldsReady, supported)
  }
})
test('disabled derived fields are located but never marked writable or verified', () => {
  const derived = { ...field, whenDisabled: 'readback_only' }
  const result = observe(shell(select('disabled readonly')), [derived])
  const report = assessLocatorCoverage(result.fieldResults, 1, [derived])
  assert.equal(report.basicFieldsLocated, true)
  assert.equal(report.basicFieldsReady, false)
  assert.equal(report.fields[0].status, 'derived_readback_required')
  assert.equal(report.fields[0].permittedOperation, 'readback_only')
  assert.equal(assessLocatorCoverage(result.fieldResults, 1, [field]).fields[0].status, 'disabled_control')
})
test('duplicate labels, multiple inputs and adjacent fields stop deterministic positioning', () => {
  assert.equal(observe(shell(select()) + shell(select())).fieldResults[0].status, 'ambiguous_label')
  assert.equal(observe(shell(select() + '<input>')).fieldResults[0].status, 'ambiguous_control')
  assert.equal(observe(shell('') + '<div data-testid="beast-core-form-item"><input></div>').fieldResults[0].status, 'missing_control')
})
