import { assertPddEditorUrl, tshirtLocatorContract as contract } from './pdd-locator-contract.mjs'
import { observePddFields } from './pdd-observe.mjs'
import {hasVerifiedDraftScope} from './pdd-draft-write-scope.mjs'

const allowed = new Set(['listing.title', 'product.productCode'])
export function compileBasicPlan(input) {
  if (input?.scope !== 'pdd-tshirt-basic-v1' || !Array.isArray(input.fields) || !input.fields.length) throw new Error('BASIC_PLAN_INVALID')
  const seen = new Set()
  const fields = input.fields.map(item => {
    if (!allowed.has(item.key) || seen.has(item.key) || typeof item.value !== 'string' || !item.value.trim()) throw new Error('BASIC_FIELD_INVALID')
    seen.add(item.key)
    if (item.key === 'listing.title' && [...item.value].length > 30) throw new Error('TITLE_TOO_LONG')
    return Object.freeze({ key:item.key, value:item.value, label:contract.fields.find(f=>f.key===item.key).label })
  })
  return Object.freeze({ scope:input.scope, fields:Object.freeze(fields), terminalAction:'stop_before_save' })
}

export async function assertReadbackScope(page) {
  assertPddEditorUrl(page.url())
  const modes = [...page.url().matchAll(/[?&]type=([^&]*)/g)].map(m=>m[1])
  if (modes.length !== 1 || !['add','edit'].includes(modes[0])) throw new Error('EDITOR_MODE_INVALID')
  if (await page.getByText(contract.scope.categoryBreadcrumb, {exact:true}).count() !== 1) throw new Error('CATEGORY_NOT_CONFIRMED')
}
export async function assertBasicScope(page) {
  await assertReadbackScope(page)
  if (!/[?&]type=add(?:&|$)/.test(page.url())&&!hasVerifiedDraftScope(page)) throw new Error('NEW_PRODUCT_PAGE_REQUIRED')
}
async function inputFor(page, field) {
  await assertBasicScope(page)
  const observation = await page.evaluate(observePddFields, { fields:contract.fields.filter(f=>f.key===field.key), forbiddenActions:[], allowedAction:'保存草稿' })
  const result = observation.fieldResults[0]
  if (result?.status !== 'unique' || result.control.disabled || result.control.readOnly || result.control.component || !['input','textarea'].includes(result.control.tag)) throw new Error(`FIELD_NOT_WRITABLE:${field.key}`)
  const container = page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:new RegExp(`^${field.label}$`)})})
  // Parent form items may contain nested fields. Keep only the nearest matching container.
  const exact = container.filter({hasNot:page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:new RegExp(`^${field.label}$`)})})})
  const control = exact.locator('input:visible,textarea:visible')
  if (await control.count() !== 1) throw new Error(`FIELD_AMBIGUOUS:${field.key}`)
  return control
}
export async function executeBasicPlan(page, raw, { dryRun = true } = {}) {
  const plan = compileBasicPlan(raw)
  await assertBasicScope(page)
  // Preflight every requested field before the first mutation.
  const before = []
  for (const field of plan.fields) before.push({key:field.key,value:await (await inputFor(page,field)).inputValue()})
  if (dryRun) return {scope:plan.scope,status:'preflight_passed',requestedFields:plan.fields.map(f=>f.key),saved:false,published:false}
  const observed = []
  try {
    for (const field of plan.fields) {
      const input = await inputFor(page,field)
      await input.fill(field.value)
      await input.blur()
      const value = await (await inputFor(page,field)).inputValue()
      if (value !== field.value) throw new Error(`READBACK_MISMATCH:${field.key}`)
      observed.push({key:field.key,value})
    }
    // Recheck the full subset after all blur/validation handlers have run.
    for (const field of plan.fields) if (await (await inputFor(page,field)).inputValue() !== field.value) throw new Error(`FINAL_READBACK_MISMATCH:${field.key}`)
    return {scope:plan.scope,status:'subset_verified',expected:plan.fields,observed,saved:false,published:false,fullProductVerified:false}
  } catch (error) {
    error.partialResult = {status:'needs_inspection',before,observed,saved:false,published:false,reason:error.message}
    throw error // Do not retry, save, publish or attempt a blind rollback.
  }
}
