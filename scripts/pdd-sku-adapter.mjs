import { assertBasicScope } from './pdd-basic-adapter.mjs'
import { resolveSkuDom } from './pdd-sku-dom.mjs'

export function compileSkuPlan(input) {
  if(input?.scope!=='pdd-tshirt-sku-v1' || typeof input.productCode!=='string' || !input.productCode.trim() || !Array.isArray(input.variants) || !input.variants.length)throw new Error('SKU_PLAN_INVALID')
  const keys=new Set(),codes=new Set()
  const variants=input.variants.map(v=>{
    if(!v || !['color','size','merchantSku'].every(k=>typeof v[k]==='string' && v[k].trim()===v[k] && v[k].length>0))throw new Error('SKU_IDENTITY_INVALID')
    const key=JSON.stringify([v.color,v.size])
    if(keys.has(key) || codes.has(v.merchantSku))throw new Error('SKU_DUPLICATE_PLAN')
    keys.add(key);codes.add(v.merchantSku)
    if(!['stock','groupPriceMinor','singlePriceMinor'].every(k=>Number.isSafeInteger(v[k]) && v[k]>=0) || v.singlePriceMinor<v.groupPriceMinor || typeof v.enabled!=='boolean')throw new Error('SKU_VALUES_INVALID')
    if(!v.enabled && v.stock!==0)throw new Error('DISABLED_SKU_REQUIRES_ZERO_STOCK')
    return Object.freeze({key,color:v.color,size:v.size,stock:v.stock,groupPriceMinor:v.groupPriceMinor,singlePriceMinor:v.singlePriceMinor,merchantSku:v.merchantSku,enabled:v.enabled})
  })
  if(!variants.some(v=>v.enabled))throw new Error('SKU_ALL_DISABLED')
  return Object.freeze({scope:input.scope,productCode:input.productCode,variants:Object.freeze(variants)})
}
export function moneyText(minor){return `${Math.floor(minor/100)}.${String(minor%100).padStart(2,'0')}`}
export function parseMoney(text){
  if(typeof text!=='string' || !/^\d+(\.\d{1,2})?$/.test(text.trim()))return null
  const [major,decimals='']=text.trim().split('.')
  const cents=BigInt(major)*100n+BigInt(decimals.padEnd(2,'0'))
  return cents<=BigInt(Number.MAX_SAFE_INTEGER)?Number(cents):null
}
export function skuDifferences(plan,rows){
  const diff=[]
  for(const v of plan.variants){
    const row=rows.find(r=>r.key===v.key)
    if(!row){diff.push({key:v.key,field:'row',expected:'present',observed:'missing'});continue}
    for(const field of ['stock','groupPriceMinor','singlePriceMinor','merchantSku','enabled']) {
      const raw=row.values[field]
      const value=field.endsWith('Minor')?parseMoney(raw):field==='stock'?(/^\d+$/.test(raw)?Number(raw):null):raw
      if(value!==v[field])diff.push({key:v.key,field,expected:v[field],observed:raw})
    }
  }
  return diff
}
export async function executeSkuPlan(page,input,{dryRun=true}={}) {
  const plan=compileSkuPlan(input),expectedKeys=plan.variants.map(v=>v.key),initialUrl=page.url()
  const guard=async()=>{
    if(page.url()!==initialUrl)throw new Error('PAGE_CHANGED')
    await assertBasicScope(page)
    const code=page.getByTestId('beast-core-form-item').filter({has:page.locator('label').filter({hasText:/^商品货号$/})}).locator('input:visible')
    if(await code.count()!==1 || await code.inputValue()!==plan.productCode)throw new Error('PRODUCT_CODE_MISMATCH')
  }
  const read=async()=>{await guard();return page.evaluate(resolveSkuDom,{expectedKeys})}
  const checkControls=rows=>{for(const row of rows)for(const [field,c] of Object.entries(row.controls))if(c.readOnly || (c.disabled && !(field==='stock' && row.values.enabled===false && row.values.stock==='0')))throw new Error(`SKU_NOT_WRITABLE:${row.key}:${field}`)}
  const before=await read();checkControls(before)
  if(dryRun)return {status:'preflight_passed',scope:plan.scope,productCode:plan.productCode,expected:plan.variants,before,saved:false,published:false,fullProductVerified:false}
  const completed=[]
  try {
    for(const variant of plan.variants)for(const field of (variant.enabled?['enabled','stock','groupPriceMinor','singlePriceMinor','merchantSku']:['stock','groupPriceMinor','singlePriceMinor','merchantSku','enabled'])) {
      const current=await read();checkControls(current)
      const row=current.find(r=>r.key===variant.key)
      if(field==='stock' && row.controls.stock.disabled && variant.stock===0 && row.values.stock==='0')continue
      if(field==='enabled' && row.values.enabled===variant.enabled)continue
      // Resolve the latest DOM element by business key in one page callback.
      const handle=await page.evaluateHandle(resolveSkuDom,{expectedKeys,target:{key:variant.key,field}})
      const element=handle.asElement()
      if(!element){await handle.dispose();throw new Error('SKU_TARGET_NOT_ELEMENT')}
      try {
        if(field==='stock' && row.controls.stock.disabled && variant.stock===0 && row.values.stock==='0')continue
      if(field==='enabled')await element.click({timeout:5000})
        else {await element.fill(field.endsWith('Minor')?moneyText(variant[field]):String(variant[field]),{timeout:5000});await element.press('Tab',{timeout:5000})}
      } finally {await handle.dispose()}
      const after=await read()
      const mismatch=skuDifferences({variants:[variant]},after).filter(d=>d.field===field)
      if(mismatch.length){const error=new Error('SKU_READBACK_MISMATCH');error.differences=mismatch;throw error}
      completed.push({key:variant.key,field})
    }
    const observed=await read(),differences=skuDifferences(plan,observed)
    if(differences.length){const error=new Error('SKU_FINAL_READBACK_MISMATCH');error.differences=differences;throw error}
    return {status:'sku_subset_verified',scope:plan.scope,productCode:plan.productCode,expected:plan.variants,observed,differences:[],saved:false,published:false,fullProductVerified:false}
  } catch(error){error.partialResult={status:'needs_inspection',scope:plan.scope,reason:error.message,before,completed,differences:error.differences || [],saved:false,published:false,fullProductVerified:false};throw error}
}

// Bridge the unified ProductPackage to the same validated execution plan.
// Prices/stocks come from listing offers; names/codes come from actual variants.
export function compileSkuPlanFromPackage(pkg) {
  if(pkg?.schemaVersion!=='0.1' || pkg.product?.categoryKey!=='womenswear.tshirt' || pkg.listing?.platform!=='pdd' || !Array.isArray(pkg.variants) || !Array.isArray(pkg.listing.offers))throw new Error('PRODUCT_PACKAGE_SCOPE_UNSUPPORTED')
  const ids=new Set(),offers=new Map()
  for(const offer of pkg.listing.offers){if(offers.has(offer.variantId))throw new Error('DUPLICATE_OFFER');offers.set(offer.variantId,offer)}
  const variants=pkg.variants.map(v=>{
    if(typeof v.id!=='string' || !v.id || ids.has(v.id))throw new Error('DUPLICATE_OR_EMPTY_VARIANT_ID')
    ids.add(v.id)
    const offer=offers.get(v.id)
    if(!offer || !Array.isArray(offer.prices))throw new Error('OFFER_MISSING')
    const amount=role=>{const matched=offer.prices.filter(p=>p.role===role);if(matched.length!==1 || matched[0].currency!=='CNY')throw new Error('PRICE_ROLE_INVALID');return matched[0].amountMinor}
    return {color:v.colorLabel,size:v.sizeLabel,merchantSku:v.merchantSku,stock:offer.stock,enabled:offer.enabled,groupPriceMinor:amount('sale'),singlePriceMinor:amount('platform:pdd.single')}
  })
  if(ids.size!==offers.size)throw new Error('EXTRA_OFFER')
  return compileSkuPlan({scope:'pdd-tshirt-sku-v1',productCode:pkg.product.productCode,variants})
}
